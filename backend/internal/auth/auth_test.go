package auth

import (
	"context"
	"testing"
	"watchparty-backend/internal/store"
)

func TestAuthFlow(t *testing.T) {
	ctx := context.Background()
	memStore := store.NewMemoryStore()
	authService := NewAuthService("test-secret-key", memStore)
	defer authService.Close()

	// 1. Request OTP
	code, err := authService.RequestOTP("shubh@example.com")
	if err != nil {
		t.Fatalf("request otp failed: %v", err)
	}
	if len(code) != 6 {
		t.Fatalf("expected 6-digit code, got %s", code)
	}

	// 2. Cooldown test: Immediate second request should be rate-limited
	_, err = authService.RequestOTP("shubh@example.com")
	if err != ErrRateLimited {
		t.Fatalf("expected ErrRateLimited on immediate retry, got %v", err)
	}

	// 3. Verify with valid OTP
	user, token, err := authService.VerifyOTP(ctx, "shubh@example.com", code, "Shubh", "")
	if err != nil {
		t.Fatalf("verify otp failed: %v", err)
	}
	if user.Name != "Shubh" || token == "" {
		t.Fatalf("invalid user or token: %+v", user)
	}

	// 4. Validate JWT
	claims, err := authService.ValidateToken(token)
	if err != nil {
		t.Fatalf("validate token failed: %v", err)
	}
	if claims.UserID != user.ID || claims.Email != user.Email {
		t.Fatalf("claims mismatch: %+v", claims)
	}

	// 5. Test that master backdoor "123456" is rejected
	_, _, err = authService.VerifyOTP(ctx, "gf@example.com", "123456", "Girlfriend", "")
	if err != ErrInvalidOTP {
		t.Fatalf("unregistered user with backdoor 123456 must be rejected, got: %v", err)
	}
}

func TestBruteForceLockout(t *testing.T) {
	ctx := context.Background()
	memStore := store.NewMemoryStore()
	authService := NewAuthService("test-secret-key", memStore)
	defer authService.Close()

	// Request OTP
	code, err := authService.RequestOTP("victim@example.com")
	if err != nil {
		t.Fatalf("request otp failed: %v", err)
	}

	// Attempt 5 incorrect codes
	for i := 0; i < 5; i++ {
		_, _, err := authService.VerifyOTP(ctx, "victim@example.com", "000000", "Attacker", "")
		if err != ErrInvalidOTP {
			t.Fatalf("attempt %d: expected ErrInvalidOTP, got %v", i+1, err)
		}
	}

	// 6th attempt (even with valid code) should be locked out
	_, _, err = authService.VerifyOTP(ctx, "victim@example.com", code, "Victim", "")
	if err != ErrInvalidOTP && err != ErrTooManyTries {
		t.Fatalf("expected lockout, got %v", err)
	}
}
