package routes

import (
	"cms-server-go/db"
	"cms-server-go/middleware"
	"cms-server-go/models"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

const saltRounds = 10

// RegisterUserRoutes 注册用户管理路由
func RegisterUserRoutes(r *gin.RouterGroup) {
	users := r.Group("/users", middleware.RequireAuth(), middleware.RequireSuperAdmin())
	{
		users.GET("", listUsers)
		users.POST("", createUser)
		users.PUT("/:id", resetPassword)
		users.PUT("/:id/permissions", updatePermissions)
		users.DELETE("/:id", deleteUser)
	}
}

// listUsers GET /api/users
func listUsers(c *gin.Context) {
	rows, err := db.DB.Query(
		"SELECT id, username, role, created_at, last_login FROM users ORDER BY id",
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var result []models.UserWithPerms
	for rows.Next() {
		var u models.UserWithPerms
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt, &u.LastLogin); err != nil {
			continue
		}

		// 获取权限
		permRows, err := db.DB.Query("SELECT page_key FROM page_permissions WHERE user_id = ?", u.ID)
		if err == nil {
			var perms []string
			for permRows.Next() {
				var p string
				if permRows.Scan(&p) == nil {
					perms = append(perms, p)
				}
			}
			permRows.Close()
			u.Permissions = perms
		}
		if u.Permissions == nil {
			u.Permissions = []string{}
		}

		result = append(result, u)
	}

	if result == nil {
		result = []models.UserWithPerms{}
	}
	c.JSON(http.StatusOK, result)
}

// createUser POST /api/users
func createUser(c *gin.Context) {
	var req models.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户名和密码不能为空"})
		return
	}

	if req.Role != "" && req.Role != "editor" && req.Role != "super_admin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "角色值无效"})
		return
	}

	role := req.Role
	if role == "" {
		role = "editor"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), saltRounds)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码加密失败"})
		return
	}

	result, err := db.DB.Exec(
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		req.Username, string(hash), role,
	)
	if err != nil {
		if contains(err.Error(), "UNIQUE") || contains(err.Error(), "Duplicate") {
			c.JSON(http.StatusConflict, gin.H{"error": "用户名已存在"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	newID, _ := result.LastInsertId()

	// 写入页面权限
	if len(req.Permissions) > 0 {
		for _, p := range req.Permissions {
			db.DB.Exec("INSERT IGNORE INTO page_permissions (user_id, page_key) VALUES (?, ?)", newID, p)
		}
	}

	permsJSON, _ := json.Marshal(req.Permissions)
	middleware.Audit(c, "create_user", "user:"+req.Username, string(permsJSON))

	c.JSON(http.StatusOK, gin.H{"id": newID, "username": req.Username, "role": role})
}

// resetPassword PUT /api/users/:id
func resetPassword(c *gin.Context) {
	targetID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户 ID"})
		return
	}

	var req models.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码不能为空"})
		return
	}

	if len(req.Password) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码长度至少6位"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), saltRounds)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "密码加密失败"})
		return
	}

	db.DB.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(hash), targetID)
	middleware.Audit(c, "reset_password", "user:id:"+c.Param("id"), "")
	c.JSON(http.StatusOK, gin.H{"message": "密码已重置"})
}

// updatePermissions PUT /api/users/:id/permissions
func updatePermissions(c *gin.Context) {
	targetID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户 ID"})
		return
	}

	var req models.UpdatePermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "permissions 必须是数组"})
		return
	}

	// 删除旧权限
	db.DB.Exec("DELETE FROM page_permissions WHERE user_id = ?", targetID)

	// 写入新权限
	for _, p := range req.Permissions {
		db.DB.Exec("INSERT IGNORE INTO page_permissions (user_id, page_key) VALUES (?, ?)", targetID, p)
	}

	permsJSON, _ := json.Marshal(req.Permissions)
	middleware.Audit(c, "update_permissions", "user:id:"+c.Param("id"), string(permsJSON))
	c.JSON(http.StatusOK, gin.H{"message": "权限已更新"})
}

// deleteUser DELETE /api/users/:id
func deleteUser(c *gin.Context) {
	targetID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的用户 ID"})
		return
	}

	userID, _ := c.Get("userID")
	if uid, ok := userID.(int64); ok && uid == targetID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不能删除自己的账号"})
		return
	}

	// 获取用户名用于日志
	var username string
	db.DB.QueryRow("SELECT username FROM users WHERE id = ?", targetID).Scan(&username)

	db.DB.Exec("DELETE FROM users WHERE id = ?", targetID)
	// page_permissions 会自动级联删除（FOREIGN KEY ON DELETE CASCADE）

	middleware.Audit(c, "delete_user", "user:"+username, "")
	c.JSON(http.StatusOK, gin.H{"message": "账号已删除"})
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsInner(s, substr))
}

func containsInner(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// 确保 sql 包被引用
var _ = sql.ErrNoRows
