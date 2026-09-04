package websocket

import (
	"encoding/json"
	"errors"
	"log"
	"sync"
	"time"
	"watchparty-backend/internal/model"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 65536
)

// Client represents a connected user in a room
type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	UserID   string
	UserName string
	Avatar   string
	RoomID   string
	IsHost   bool

	mu sync.Mutex
}

// ReadPump pumps messages from the websocket connection to the hub
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws error: %v", err)
			}
			break
		}

		var wsMsg model.WSIncomingMessage
		if err := json.Unmarshal(message, &wsMsg); err != nil {
			log.Printf("invalid json: %v", err)
			continue
		}

		wsMsg.UserID = c.UserID
		wsMsg.RoomID = c.RoomID
		c.Hub.HandleIncomingMessage(c, &wsMsg)
	}
}

// WritePump pumps messages from the hub to the websocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Drain queued messages
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// SendRaw queues raw serialized bytes to the client channel; evicts if client is stalled
func (c *Client) SendRaw(data []byte) error {
	select {
	case c.Send <- data:
		return nil
	default:
		log.Printf("warning: client %s buffer full, disconnecting stalled client", c.UserID)
		c.Conn.Close()
		return errors.New("client buffer overflow")
	}
}

// SendJSON marshals an arbitrary struct and queues it to the client
func (c *Client) SendJSON(v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.SendRaw(data)
}
