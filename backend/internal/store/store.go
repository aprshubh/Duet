package store

import (
	"context"
	"watchparty-backend/internal/model"
)

// Store defines the interface for persistence (supported by MemoryStore and PostgresStore/Redis)
type Store interface {
	// User operations
	CreateUser(ctx context.Context, user *model.User) error
	GetUserByID(ctx context.Context, id string) (*model.User, error)
	GetUserByEmail(ctx context.Context, email string) (*model.User, error)

	// Room operations
	CreateRoom(ctx context.Context, room *model.Room) error
	GetRoomByCode(ctx context.Context, code string) (*model.Room, error)
	GetRoomByID(ctx context.Context, id string) (*model.Room, error)
	UpdateRoomSettings(ctx context.Context, roomID string, onlyHostCanControl bool) error

	// Room Member operations
	AddMember(ctx context.Context, member *model.RoomMember) error
	RemoveMember(ctx context.Context, roomID, userID string) error
	GetRoomMembers(ctx context.Context, roomID string) ([]model.RoomMember, error)
	UpdateMemberOnline(ctx context.Context, roomID, userID string, isOnline bool) error

	// Message operations
	SaveMessage(ctx context.Context, msg *model.Message) error
	GetRecentMessages(ctx context.Context, roomID string, limit int) ([]model.Message, error)

	// Video State operations (Redis / Fast In-Memory)
	GetVideoState(ctx context.Context, roomID string) (*model.VideoState, error)
	SetVideoState(ctx context.Context, state *model.VideoState) error
}
