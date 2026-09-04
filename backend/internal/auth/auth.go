package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"
	"watchparty-backend/internal/model"
	"watchparty-backend/internal/store"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken = errors.New("invalid or expired token")
	ErrInvalidOTP   = errors.New("invalid or expired OTP")
	ErrTooManyTries = errors.New("too many failed verification attempts, please request a new code")
	ErrRateLimited  = errors.New("please wait 60 seconds before requesting another code")
)

type AuthService struct {
	jwtSecret  []byte
	store      store.Store
	mu         sync.Mutex
	otpMap     map[string]otpRecord // email -> otpRecord
	stopPruner chan struct{}
}

type otpRecord struct {
	code           string
	expiresAt      time.Time
	createdAt      time.Time
	failedAttempts int
}

type Claims struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Avatar string `json:"avatar"`
	jwt.RegisteredClaims
}

func NewAuthService(secret string, s store.Store) *AuthService {
	if secret == "" {
		secret = "super-secret-dyuet-jwt-key-change-in-prod"
	}
	svc := &AuthService{
		jwtSecret:  []byte(secret),
		store:      s,
		otpMap:     make(map[string]otpRecord),
		stopPruner: make(chan struct{}),
	}

	// Background ticker to prune expired OTPs and prevent memory leaks
	go svc.startPruner()

	return svc
}

// Close gracefully stops the background pruner
func (a *AuthService) Close() {
	select {
	case <-a.stopPruner:
	default:
		close(a.stopPruner)
	}
}

func (a *AuthService) startPruner() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			a.mu.Lock()
			now := time.Now()
			for email, record := range a.otpMap {
				if now.After(record.expiresAt) {
					delete(a.otpMap, email)
				}
			}
			a.mu.Unlock()
		case <-a.stopPruner:
			return
		}
	}
}

// GenerateToken creates a signed JWT for a user (valid for 7 days)
func (a *AuthService) GenerateToken(user *model.User) (string, error) {
	claims := Claims{
		UserID: user.ID,
		Name:   user.Name,
		Email:  user.Email,
		Avatar: user.Avatar,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "dyuet",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(a.jwtSecret)
}

// ValidateToken verifies JWT and returns claims
func (a *AuthService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return a.jwtSecret, nil
	})

	if err != nil {
		return nil, ErrInvalidToken
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, ErrInvalidToken
}

// RequestOTP generates a 6-digit OTP code for an email address with a 60s cooldown
func (a *AuthService) RequestOTP(email string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	email = strings.TrimSpace(strings.ToLower(email))

	// Check 60-second request cooldown
	if existing, exists := a.otpMap[email]; exists {
		if time.Since(existing.createdAt) < 60*time.Second {
			return "", ErrRateLimited
		}
	}

	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	code := fmt.Sprintf("%06d", n.Int64()+100000)

	a.otpMap[email] = otpRecord{
		code:           code,
		createdAt:      time.Now(),
		expiresAt:      time.Now().Add(10 * time.Minute),
		failedAttempts: 0,
	}

	return code, nil
}

// VerifyOTP verifies email + OTP and returns user + JWT token (max 5 failed attempts)
func (a *AuthService) VerifyOTP(ctx context.Context, email, code, preferredName, avatar string) (*model.User, string, error) {
	email = strings.TrimSpace(strings.ToLower(email))

	a.mu.Lock()
	record, exists := a.otpMap[email]
	if !exists || time.Now().After(record.expiresAt) {
		if exists {
			delete(a.otpMap, email)
		}
		a.mu.Unlock()
		return nil, "", ErrInvalidOTP
	}

	// Brute-force protection: max 5 attempts
	if record.failedAttempts >= 5 {
		delete(a.otpMap, email)
		a.mu.Unlock()
		return nil, "", ErrTooManyTries
	}

	if record.code != code {
		record.failedAttempts++
		a.otpMap[email] = record
		a.mu.Unlock()
		return nil, "", ErrInvalidOTP
	}

	delete(a.otpMap, email)
	a.mu.Unlock()

	// Check if user exists, or create new
	user, err := a.store.GetUserByEmail(ctx, email)
	if err != nil {
		if preferredName == "" {
			prefix := email
			if idx := strings.Index(email, "@"); idx > 0 {
				prefix = email[:idx]
			}
			if len(prefix) > 8 {
				prefix = prefix[:8]
			}
			preferredName = "User-" + prefix
		}
		if avatar == "" {
			avatar = fmt.Sprintf("https://api.dicebear.com/7.x/initials/svg?seed=%s&backgroundColor=6366f1,ec4899,0284c7,10b981,8b5cf6&fontWeight=700", email)
		}
		user = &model.User{
			ID:        uuid.NewString(),
			Name:      preferredName,
			Email:     email,
			Avatar:    avatar,
			CreatedAt: time.Now(),
		}
		if err := a.store.CreateUser(ctx, user); err != nil {
			return nil, "", err
		}
	}

	token, err := a.GenerateToken(user)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

// GoogleLogin handles Google authenticated profile provisioning
func (a *AuthService) GoogleLogin(ctx context.Context, email, name, avatar string) (*model.User, string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	user, err := a.store.GetUserByEmail(ctx, email)
	if err != nil {
		user = &model.User{
			ID:        uuid.NewString(),
			Name:      name,
			Email:     email,
			Avatar:    avatar,
			CreatedAt: time.Now(),
		}
		if err := a.store.CreateUser(ctx, user); err != nil {
			return nil, "", err
		}
	}

	token, err := a.GenerateToken(user)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

// GuestLogin creates an instant guest profile (e.g. for quick joining without email)
func (a *AuthService) GuestLogin(ctx context.Context, name string) (*model.User, string, error) {
	if name == "" {
		name = "Guest-" + uuid.NewString()[:5]
	}
	user := &model.User{
		ID:        uuid.NewString(),
		Name:      name,
		Email:     "",
		Avatar:    fmt.Sprintf("https://api.dicebear.com/7.x/initials/svg?seed=%s&backgroundColor=6366f1,ec4899,0284c7,10b981,8b5cf6&fontWeight=700", name),
		CreatedAt: time.Now(),
	}
	if err := a.store.CreateUser(ctx, user); err != nil {
		return nil, "", err
	}

	token, err := a.GenerateToken(user)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}
