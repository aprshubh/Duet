package websocket

import (
	"context"
	"encoding/json"
	"testing"
	"time"
	"watchparty-backend/internal/model"
	"watchparty-backend/internal/store"
	"watchparty-backend/internal/video"
)

func TestHubRegistrationAndBroadcast(t *testing.T) {
	memStore := store.NewMemoryStore()
	syncer := video.NewVideoSyncer(memStore)
	hub := NewHub(memStore, nil, syncer)
	go hub.Run()

	room := &model.Room{
		ID:        "room-test",
		Code:      "ABC999",
		HostID:    "user-1",
		CreatedAt: time.Now(),
	}
	_ = memStore.CreateRoom(context.Background(), room)

	client := &Client{
		Hub:      hub,
		Send:     make(chan []byte, 64),
		UserID:   "user-1",
		UserName: "Alice",
		RoomID:   "room-test",
		IsHost:   true,
	}

	// Register client
	hub.Register <- client
	time.Sleep(50 * time.Millisecond)

	// Verify client received initial room state
	select {
	case msgBytes := <-client.Send:
		var wsMsg model.WSMessage
		if err := json.Unmarshal(msgBytes, &wsMsg); err != nil {
			t.Fatalf("failed to unmarshal room state: %v", err)
		}
		if wsMsg.Type != model.EventUserJoin && wsMsg.Type != model.EventRoomState {
			t.Logf("received message type: %s", wsMsg.Type)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("timed out waiting for initial client registration event")
	}

	// Test broadcast
	testPayload := map[string]string{"text": "hello"}
	hub.BroadcastToRoom("room-test", &model.WSMessage{
		Type:      model.EventChatMessage,
		RoomID:    "room-test",
		UserID:    "user-1",
		Payload:   testPayload,
		Timestamp: time.Now().UnixMilli(),
	})

	select {
	case msgBytes := <-client.Send:
		var wsMsg model.WSMessage
		if err := json.Unmarshal(msgBytes, &wsMsg); err != nil {
			t.Fatalf("failed to unmarshal broadcast: %v", err)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("timed out waiting for broadcast message")
	}

	// Unregister client
	hub.Unregister <- client
	time.Sleep(50 * time.Millisecond)
}
