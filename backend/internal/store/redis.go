package store

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"watchparty-backend/internal/model"

	"github.com/redis/go-redis/v9"
)

// RedisStore handles distributed Pub/Sub, fast ephemeral video state, and rate limiting
type RedisStore struct {
	client *redis.Client
}

// NewRedisStore connects to Redis server
func NewRedisStore(addr, password string, db int) (*RedisStore, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis at %s: %w", addr, err)
	}

	return &RedisStore{client: rdb}, nil
}

// Close closes the Redis connection
func (r *RedisStore) Close() error {
	if r.client != nil {
		return r.client.Close()
	}
	return nil
}

// PublishRoomEvent publishes an encoded WebSocket event to a room's Redis Pub/Sub channel
func (r *RedisStore) PublishRoomEvent(ctx context.Context, roomID string, data []byte) error {
	channel := fmt.Sprintf("duet:room:%s:events", roomID)
	return r.client.Publish(ctx, channel, data).Err()
}

// SubscribeRoomEvents subscribes to cross-node broadcasts for a given room
func (r *RedisStore) SubscribeRoomEvents(ctx context.Context, roomID string) *redis.PubSub {
	channel := fmt.Sprintf("duet:room:%s:events", roomID)
	return r.client.Subscribe(ctx, channel)
}

// SetVideoState caches the authoritative video playback state
func (r *RedisStore) SetVideoState(ctx context.Context, state *model.VideoState) error {
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	key := fmt.Sprintf("duet:room:%s:video", state.RoomID)
	return r.client.Set(ctx, key, data, 24*time.Hour).Err()
}

// GetVideoState retrieves cached video playback state
func (r *RedisStore) GetVideoState(ctx context.Context, roomID string) (*model.VideoState, error) {
	key := fmt.Sprintf("duet:room:%s:video", roomID)
	val, err := r.client.Get(ctx, key).Result()
	if err == redis.Nil {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, err
	}

	var state model.VideoState
	if err := json.Unmarshal([]byte(val), &state); err != nil {
		return nil, err
	}
	return &state, nil
}

// SetPresence updates a user's presence in a room
func (r *RedisStore) SetPresence(ctx context.Context, roomID, userID string, isOnline bool) error {
	key := fmt.Sprintf("duet:room:%s:presence", roomID)
	status := "offline"
	if isOnline {
		status = "online"
	}
	return r.client.HSet(ctx, key, userID, status).Err()
}

// GetPresence retrieves all members' presence in a room
func (r *RedisStore) GetPresence(ctx context.Context, roomID string) (map[string]string, error) {
	key := fmt.Sprintf("duet:room:%s:presence", roomID)
	return r.client.HGetAll(ctx, key).Result()
}

// CheckRateLimit implements a sliding/fixed window rate limiter in Redis
func (r *RedisStore) CheckRateLimit(ctx context.Context, key string, maxRequests int64, window time.Duration) (bool, error) {
	redisKey := fmt.Sprintf("duet:ratelimit:%s", key)
	count, err := r.client.Incr(ctx, redisKey).Result()
	if err != nil {
		return false, err
	}
	if count == 1 {
		r.client.Expire(ctx, redisKey, window)
	}
	return count <= maxRequests, nil
}
