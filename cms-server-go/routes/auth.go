package routes

import (
	"cms-server-go/db"
	"cms-server-go/middleware"
	"cms-server-go/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// RegisterAuthRoutes 注册认证路由
func RegisterAuthRoutes(r *gin.RouterGroup) {
	auth := r.Group("/auth")
	{
		auth.POST("/login", login)
		auth.GET("/me", me)
	}
}

// login POST /api/auth/login
func login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户名和密码不能为空"})
		return
	}

	var user models.User
	err := db.DB.QueryRow(
		"SELECT id, username, password_hash, role FROM users WHERE username = ?",
		req.Username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	// 验证密码
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户名或密码错误"})
		return
	}

	// 更新最后登录时间
	db.DB.Exec("UPDATE users SET last_login = NOW() WHERE id = ?", user.ID)

	// 获取页面权限
	perms := []string{}
	rows, err := db.DB.Query("SELECT page_key FROM page_permissions WHERE user_id = ?", user.ID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p string
			if rows.Scan(&p) == nil {
				perms = append(perms, p)
			}
		}
	}

	// 生成 JWT
	token, err := middleware.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "令牌生成失败"})
		return
	}

	// 审计日志
	middleware.Audit(c, "login", "user:"+user.Username, "IP: "+c.ClientIP())

	c.JSON(http.StatusOK, models.LoginResponse{
		Token: token,
		User: models.UserWithPerms{
			ID:          user.ID,
			Username:    user.Username,
			Role:        user.Role,
			Permissions: perms,
		},
	})
}

// me GET /api/auth/me
func me(c *gin.Context) {
	header := c.GetHeader("Authorization")
	if header == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未认证"})
		return
	}

	claims, err := middleware.VerifyToken(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "令牌已失效"})
		return
	}

	var user models.User
	err = db.DB.QueryRow(
		"SELECT id, username, role, created_at, last_login FROM users WHERE id = ?",
		claims.ID,
	).Scan(&user.ID, &user.Username, &user.Role, &user.CreatedAt, &user.LastLogin)

	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "用户不存在"})
		return
	}

	// 获取页面权限
	perms := []string{}
	rows, err := db.DB.Query("SELECT page_key FROM page_permissions WHERE user_id = ?", user.ID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p string
			if rows.Scan(&p) == nil {
				perms = append(perms, p)
			}
		}
	}

	c.JSON(http.StatusOK, models.UserWithPerms{
		ID:          user.ID,
		Username:    user.Username,
		Role:        user.Role,
		CreatedAt:   user.CreatedAt,
		LastLogin:   user.LastLogin,
		Permissions: perms,
	})
}
