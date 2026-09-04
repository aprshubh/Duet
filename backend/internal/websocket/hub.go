package websocket

import (
	"context"
	"encoding/json"
	"html"
	"log"
	"sync"
	"time"
	"watchparty-backend/internal/model"
	"watchparty-backend/internal/store"
	"watchparty-backend/internal/video"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// RedisPubSubEnvelope wraps room broadcasts to filter self-published messages
type RedisPubSubEnvelope struct {
	OriginNode string `json:"originNode"`
	RoomID     string `json:"roomId"`
	Data       []byte `json:"data"`
}

// Hub maintains the set of active clients and broadcasts messages to rooms
type Hub struct {
	store         store.Store
	redisStore    *store.RedisStore
	syncer        *video.VideoSyncer
	rooms         map[string]map[*Client]bool // roomID -> set of clients
	roomSubs      map[string]*redis.PubSub    // roomID -> redis pubsub
	roomVideoURLs map[string]*model.VideoURLPayload
	Register      chan *Client
	Unregister    chan *Client
	instanceID    string
	mu            sync.RWMutex
}

func NewHub(s store.Store, r *store.RedisStore, v *video.VideoSyncer) *Hub {
	return &Hub{
		store:         s,
		redisStore:    r,
		syncer:        v,
		rooms:         make(map[string]map[*Client]bool),
		roomSubs:      make(map[string]*redis.PubSub),
		roomVideoURLs: make(map[string]*model.VideoURLPayload),
		Register:      make(chan *Client),
		Unregister:    make(chan *Client),
		instanceID:    uuid.NewString(),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.registerClient(client)

		case client := <-h.Unregister:
			h.unregisterClient(client)
		}
	}
}

func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	isFirstInRoom := false
	if h.rooms[client.RoomID] == nil {
		h.rooms[client.RoomID] = make(map[*Client]bool)
		isFirstInRoom = true
	}
	h.rooms[client.RoomID][client] = true

	if isFirstInRoom && h.redisStore != nil {
		h.subscribeRoomRedis(client.RoomID)
	}
	h.mu.Unlock()

	// Asynchronous DB update to keep Hub event loop non-blocking
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := h.store.UpdateMemberOnline(ctx, client.RoomID, client.UserID, true)
		if err != nil {
			user, _ := h.store.GetUserByID(ctx, client.UserID)
			if user == nil {
				user = &model.User{ID: client.UserID, Name: client.UserName, Avatar: client.Avatar}
			}
			_ = h.store.AddMember(ctx, &model.RoomMember{
				RoomID:   client.RoomID,
				UserID:   client.UserID,
				User:     *user,
				IsHost:   client.IsHost,
				JoinedAt: time.Now(),
				IsOnline: true,
			})
		}
	}()

	// Broadcast user join event
	h.BroadcastToRoom(client.RoomID, &model.WSMessage{
		Type:      model.EventUserJoin,
		RoomID:    client.RoomID,
		UserID:    client.UserID,
		Timestamp: time.Now().UnixMilli(),
		Payload: map[string]interface{}{
			"userId":   client.UserID,
			"userName": client.UserName,
			"avatar":   client.Avatar,
			"isHost":   client.IsHost,
			"isOnline": true,
		},
	})

	// Send initial room state to newly connected client
	go h.sendInitialRoomState(client)
}

func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	userStillConnected := false
	shouldUnsub := false
	if roomClients, ok := h.rooms[client.RoomID]; ok {
		if _, exists := roomClients[client]; exists {
			delete(roomClients, client)
			close(client.Send)
			if len(roomClients) == 0 {
				delete(h.rooms, client.RoomID)
				shouldUnsub = true
			} else {
				for c := range roomClients {
					if c.UserID == client.UserID {
						userStillConnected = true
						break
					}
				}
			}
		}
	}

	if shouldUnsub && h.redisStore != nil {
		if sub, ok := h.roomSubs[client.RoomID]; ok {
			_ = sub.Close()
			delete(h.roomSubs, client.RoomID)
		}
	}
	h.mu.Unlock()

	if !userStillConnected {
		// Asynchronous DB update
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			_ = h.store.UpdateMemberOnline(ctx, client.RoomID, client.UserID, false)
		}()

		// Broadcast user leave event
		h.BroadcastToRoom(client.RoomID, &model.WSMessage{
			Type:      model.EventUserLeave,
			RoomID:    client.RoomID,
			UserID:    client.UserID,
			Timestamp: time.Now().UnixMilli(),
			Payload: map[string]interface{}{
				"userId":   client.UserID,
				"userName": client.UserName,
				"isOnline": false,
			},
		})

		// Clean up voice presence
		h.BroadcastToRoom(client.RoomID, &model.WSMessage{
			Type:      model.EventVoiceState,
			RoomID:    client.RoomID,
			UserID:    client.UserID,
			Timestamp: time.Now().UnixMilli(),
			Payload: map[string]interface{}{
				"userId":   client.UserID,
				"userName": client.UserName,
				"inVoice":  false,
				"isMuted":  true,
			},
		})
	}
}

// subscribeRoomRedis listens for cross-node broadcasts from other backend replicas
func (h *Hub) subscribeRoomRedis(roomID string) {
	ctx := context.Background()
	sub := h.redisStore.SubscribeRoomEvents(ctx, roomID)
	h.roomSubs[roomID] = sub

	go func() {
		ch := sub.Channel()
		for msg := range ch {
			var env RedisPubSubEnvelope
			if err := json.Unmarshal([]byte(msg.Payload), &env); err != nil {
				continue
			}
			// Skip events published by this same node (already broadcast locally)
			if env.OriginNode == h.instanceID {
				continue
			}
			h.BroadcastRawLocally(env.RoomID, "", env.Data)
		}
	}()
}

// sendInitialRoomState provides all needed data when joining or reconnecting
func (h *Hub) sendInitialRoomState(client *Client) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	room, err := h.store.GetRoomByID(ctx, client.RoomID)
	if err != nil {
		return
	}

	members, _ := h.store.GetRoomMembers(ctx, client.RoomID)
	messages, _ := h.store.GetRecentMessages(ctx, client.RoomID, 50)
	videoState, err := h.store.GetVideoState(ctx, client.RoomID)
	if err != nil {
		videoState = &model.VideoState{
			RoomID:    client.RoomID,
			Playing:   false,
			Position:  0.0,
			Rate:      1.0,
			UpdatedAt: time.Now().UnixMilli(),
		}
	}

	calculatedPos := h.syncer.CalculateCurrentPosition(videoState)
	stateCopy := *videoState
	stateCopy.Position = calculatedPos

	h.mu.RLock()
	activeVideoURL := h.roomVideoURLs[client.RoomID]
	h.mu.RUnlock()

	_ = client.SendJSON(&model.WSMessage{
		Type:      model.EventRoomState,
		RoomID:    client.RoomID,
		Timestamp: time.Now().UnixMilli(),
		Payload: map[string]interface{}{
			"room":       room,
			"members":    members,
			"messages":   messages,
			"videoState": stateCopy,
			"videoURL":   activeVideoURL,
		},
	})
}

// BroadcastToRoom serializes a message once and broadcasts locally + across Redis PubSub
func (h *Hub) BroadcastToRoom(roomID string, msg *model.WSMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("failed to marshal broadcast message: %v", err)
		return
	}

	// 1. Deliver to local clients in this instance immediately
	h.BroadcastRawLocally(roomID, "", data)

	// 2. Publish to Redis for other cluster nodes
	if h.redisStore != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			env := RedisPubSubEnvelope{
				OriginNode: h.instanceID,
				RoomID:     roomID,
				Data:       data,
			}
			envBytes, err := json.Marshal(env)
			if err == nil {
				_ = h.redisStore.PublishRoomEvent(ctx, roomID, envBytes)
			}
		}()
	}
}

// BroadcastExcept sends to all room clients except the specified user
func (h *Hub) BroadcastExcept(roomID string, exceptUserID string, msg *model.WSMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	h.BroadcastRawLocally(roomID, exceptUserID, data)

	if h.redisStore != nil {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			env := RedisPubSubEnvelope{
				OriginNode: h.instanceID,
				RoomID:     roomID,
				Data:       data,
			}
			envBytes, err := json.Marshal(env)
			if err == nil {
				_ = h.redisStore.PublishRoomEvent(ctx, roomID, envBytes)
			}
		}()
	}
}

// BroadcastRawLocally delivers pre-serialized raw bytes directly to connected local clients
func (h *Hub) BroadcastRawLocally(roomID string, exceptUserID string, data []byte) {
	h.mu.RLock()
	var targets []*Client
	if roomClients, ok := h.rooms[roomID]; ok {
		for c := range roomClients {
			if exceptUserID == "" || c.UserID != exceptUserID {
				targets = append(targets, c)
			}
		}
	}
	h.mu.RUnlock()

	for _, c := range targets {
		_ = c.SendRaw(data)
	}
}

// HandleIncomingMessage parses and routes incoming client events with zero double-marshal overhead
func (h *Hub) HandleIncomingMessage(client *Client, msg *model.WSIncomingMessage) {
	nowMs := time.Now().UnixMilli()
	ctx := context.Background()

	switch msg.Type {
	case model.EventPlay, model.EventPause, model.EventSeek, model.EventRate:
		var action model.VideoActionPayload
		if err := json.Unmarshal(msg.Payload, &action); err != nil {
			log.Printf("invalid video payload: %v", err)
			return
		}

		newState, err := h.syncer.HandleAction(ctx, msg.Type, client.RoomID, client.UserID, client.IsHost, action.Position, action.Rate)
		if err != nil {
			_ = client.SendJSON(&model.WSMessage{
				Type:      model.EventError,
				RoomID:    client.RoomID,
				Timestamp: nowMs,
				Payload:   map[string]string{"error": err.Error()},
			})
			return
		}

		h.BroadcastToRoom(client.RoomID, &model.WSMessage{
			Type:      msg.Type,
			RoomID:    client.RoomID,
			UserID:    client.UserID,
			Timestamp: nowMs,
			Payload:   newState,
		})

	case model.EventSyncRequest:
		var req model.SyncRequestPayload
		if err := json.Unmarshal(msg.Payload, &req); err != nil {
			return
		}

		correction, err := h.syncer.CheckSync(ctx, client.RoomID, req.ClientPosition)
		if err != nil {
			return
		}

		_ = client.SendJSON(&model.WSMessage{
			Type:      model.EventSyncCorrection,
			RoomID:    client.RoomID,
			Timestamp: nowMs,
			Payload:   correction,
		})

	case model.EventChatMessage:
		var chatPayload model.ChatPayload
		if err := json.Unmarshal(msg.Payload, &chatPayload); err != nil {
			return
		}

		sanitizedText := html.EscapeString(chatPayload.Message)
		if len(sanitizedText) == 0 || len(sanitizedText) > 2000 {
			return
		}

		chatMsg := &model.Message{
			ID:        uuid.NewString(),
			RoomID:    client.RoomID,
			UserID:    client.UserID,
			UserName:  client.UserName,
			Avatar:    client.Avatar,
			Message:   sanitizedText,
			IsSystem:  false,
			CreatedAt: time.Now(),
		}

		go func() {
			saveCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			_ = h.store.SaveMessage(saveCtx, chatMsg)
		}()

		h.BroadcastToRoom(client.RoomID, &model.WSMessage{
			Type:      model.EventChatMessage,
			RoomID:    client.RoomID,
			UserID:    client.UserID,
			Timestamp: nowMs,
			Payload:   chatMsg,
		})

	case model.EventTyping:
		var typingPayload model.TypingPayload
		_ = json.Unmarshal(msg.Payload, &typingPayload)
		typingPayload.UserName = client.UserName

		h.BroadcastExcept(client.RoomID, client.UserID, &model.WSMessage{
			Type:      model.EventTyping,
			RoomID:    client.RoomID,
			UserID:    client.UserID,
			Timestamp: nowMs,
			Payload:   typingPayload,
		})

	case model.EventUpdateSettings:
		if !client.IsHost {
			_ = client.SendJSON(&model.WSMessage{
				Type:      model.EventError,
				RoomID:    client.RoomID,
				Timestamp: nowMs,
				Payload:   map[string]string{"error": "only the host can change room settings"},
			})
			return
		}

		var settings model.UpdateSettingsPayload
		_ = json.Unmarshal(msg.Payload, &settings)

		go func() {
			upCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			_ = h.store.UpdateRoomSettings(upCtx, client.RoomID, settings.OnlyHostCanControl)
		}()

		h.BroadcastToRoom(client.RoomID, &model.WSMessage{
			Type:      model.EventUpdateSettings,
			RoomID:    client.RoomID,
			Timestamp: nowMs,
			Payload:   settings,
		})

	case model.EventAudioChangeRequest:
		var audioPayload interface{}
		_ = json.Unmarshal(msg.Payload, &audioPayload)

		h.BroadcastExcept(client.RoomID, client.UserID, &model.WSMessage{
			Type:      model.EventAudioChangeRequest,
			RoomID:    client.RoomID,
			UserID:    client.UserID,
			Timestamp: nowMs,
			Payload:   audioPayload,
		})

	case model.EventReaction:
		var reaction model.ReactionPayload
		if err := json.Unmarshal(msg.Payload, &reaction); err != nil {
			return
		}
		reaction.UserID = client.UserID
		reaction.UserName = client.UserName

		h.BroadcastToRoom(client.RoomID, &model.WSMessage{
			Type:      model.EventReaction,
			RoomID:    client.RoomID,
			UserID:    client.UserID,
			Timestamp: nowMs,
			Payload:   reaction,
		})

	case model.EventVideoURL:
		canControl := true
		if client.RoomID != "" {
			if r, err := h.store.GetRoomByID(ctx, client.RoomID); err == nil && r != nil {
				if r.OnlyHostCanControl && !client.IsHost {
					canControl = false
				}
			}
		}
		if !canControl {
			_ = client.SendJSON(&model.WSMessage{
				Type:      model.EventError,
				RoomID:    client.RoomID,
				Timestamp: nowMs,
				Payload:   map[string]string{"error": "only the host can change video"},
			})
			return
		}

		var urlPayload model.VideoURLPayload
		if err := json.Unmarshal(msg.Payload, &urlPayload); err == nil {
			h.mu.Lock()
			if urlPayload.URL != "" && urlPayload.SourceType != "file" {
				h.roomVideoURLs[client.RoomID] = &urlPayload
			} else {
				delete(h.roomVideoURLs, client.RoomID)
			}
			h.mu.Unlock()
		}

		h.BroadcastToRoom(client.RoomID, &model.WSMessage{
			Type:      model.EventVideoURL,
			RoomID:    client.RoomID,
			UserID:    client.UserID,
			Timestamp: nowMs,
			Payload:   urlPayload,
		})

	case model.EventVoiceSignal:
		var signal model.VoiceSignalPayload
		if err := json.Unmarshal(msg.Payload, &signal); err != nil {
			return
		}
		signal.SenderUserID = client.UserID

		h.mu.RLock()
		if clients, ok := h.rooms[client.RoomID]; ok {
			for targetClient := range clients {
				if targetClient.UserID == signal.TargetUserID {
					_ = targetClient.SendJSON(&model.WSMessage{
						Type:      model.EventVoiceSignal,
						RoomID:    client.RoomID,
						UserID:    client.UserID,
						Timestamp: nowMs,
						Payload:   signal,
					})
					break
				}
			}
		}
		h.mu.RUnlock()

	case model.EventVoiceState:
		var state model.VoiceStatePayload
		_ = json.Unmarshal(msg.Payload, &state)
		state.UserID = client.UserID
		state.UserName = client.UserName

		h.BroadcastToRoom(client.RoomID, &model.WSMessage{
			Type:      model.EventVoiceState,
			RoomID:    client.RoomID,
			UserID:    client.UserID,
			Timestamp: nowMs,
			Payload:   state,
		})
	}
}
