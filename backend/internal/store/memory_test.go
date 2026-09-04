package store

import (
	"context"
	"testing"
	"time"
	"watchparty-backend/internal/model"
)

func TestMemoryStoreUserAndRoom(t *testing.T) {
	ctx := context.Background()
	s := NewMemoryStore()

	// 1. User ops
	user := &model.User{
		ID:        "u1",
		Name:      "Alice",
		Email:     "alice@example.com",
		CreatedAt: time.Now(),
	}
	if err := s.CreateUser(ctx, user); err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	gotUser, err := s.GetUserByID(ctx, "u1")
	if err != nil || gotUser.Name != "Alice" {
		t.Fatalf("GetUserByID failed: %v", err)
	}

	gotByEmail, err := s.GetUserByEmail(ctx, "alice@example.com")
	if err != nil || gotByEmail.ID != "u1" {
		t.Fatalf("GetUserByEmail failed: %v", err)
	}

	// 2. Room ops
	room := &model.Room{
		ID:                 "r1",
		Code:               "XYZ123",
		HostID:             "u1",
		OnlyHostCanControl: false,
		CreatedAt:          time.Now(),
	}
	if err := s.CreateRoom(ctx, room); err != nil {
		t.Fatalf("CreateRoom failed: %v", err)
	}

	gotRoom, err := s.GetRoomByCode(ctx, "XYZ123")
	if err != nil || gotRoom.ID != "r1" {
		t.Fatalf("GetRoomByCode failed: %v", err)
	}

	// 3. Member ops
	member := &model.RoomMember{
		RoomID:   "r1",
		UserID:   "u1",
		IsHost:   true,
		IsOnline: true,
		JoinedAt: time.Now(),
	}
	if err := s.AddMember(ctx, member); err != nil {
		t.Fatalf("AddMember failed: %v", err)
	}

	members, err := s.GetRoomMembers(ctx, "r1")
	if err != nil || len(members) != 1 {
		t.Fatalf("GetRoomMembers failed: %v", err)
	}

	// 4. Video state ops
	state := &model.VideoState{
		RoomID:    "r1",
		Playing:   true,
		Position:  42.5,
		Rate:      1.0,
		UpdatedAt: time.Now().UnixMilli(),
	}
	if err := s.SetVideoState(ctx, state); err != nil {
		t.Fatalf("SetVideoState failed: %v", err)
	}

	gotState, err := s.GetVideoState(ctx, "r1")
	if err != nil || gotState.Position != 42.5 || !gotState.Playing {
		t.Fatalf("GetVideoState failed: %v", err)
	}
}

func TestMemoryStoreContextCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	s := NewMemoryStore()
	err := s.CreateUser(ctx, &model.User{ID: "u2", Name: "Bob"})
	if err != context.Canceled {
		t.Fatalf("expected context.Canceled, got: %v", err)
	}
}
