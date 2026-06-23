package middleware

import (
	"cms-server-go/config"
	"cms-server-go/db"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JWTClaims JWT 载荷
type JWTClaims struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// GenerateToken 生成 JWT Token
func GenerateToken(userID int64, username, role string) (string, error) {
	claims := JWTClaims{
		ID:       userID,
		Username: username,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.AppConfig.JWTSecret))
}

// RequireAuth 验证 JWT，注入 user 信息到 context
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌"})
			c.Abort()
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "令牌格式错误"})
			c.Abort()
			return
		}

		tokenStr := parts[1]
		claims := &JWTClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(config.AppConfig.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "令牌已失效，请重新登录"})
			c.Abort()
			return
		}

		// 注入用户信息
		c.Set("user", claims)
		c.Set("userID", claims.ID)
		c.Set("username", claims.Username)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// RequireSuperAdmin 验证超级管理员权限
func RequireSuperAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role != "super_admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "需要超级管理员权限"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// RequirePagePerm 验证页面权限
func RequirePagePerm(pageKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		if role == "super_admin" {
			c.Next()
			return
		}

		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
			c.Abort()
			return
		}

		var count int
		err := db.DB.QueryRow(
			"SELECT COUNT(*) FROM page_permissions WHERE user_id = ? AND page_key = ?",
			userID, pageKey,
		).Scan(&count)

		if err != nil || count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "无 [" + pageKey + "] 页面编辑权限"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// VerifyToken 从多种途径验证 token（AI 代理使用：header / query / cookie）
func VerifyToken(c *gin.Context) (*JWTClaims, error) {
	// 途径1：Authorization header
	header := c.GetHeader("Authorization")
	if header != "" && strings.HasPrefix(header, "Bearer ") {
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		return parseToken(tokenStr)
	}

	// 途径2：URL query token
	if tokenStr := c.Query("token"); tokenStr != "" {
		return parseToken(tokenStr)
	}

	// 途径3：Cookie
	if tokenStr, err := c.Cookie("cms_token"); err == nil && tokenStr != "" {
		return parseToken(tokenStr)
	}

	return nil, fmt.Errorf("未提供认证令牌")
}

func parseToken(tokenStr string) (*JWTClaims, error) {
	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(config.AppConfig.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, err
	}
	return claims, nil
}
