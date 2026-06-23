package models

import "time"

// User 用户模型
type User struct {
	ID           int64      `json:"id"`
	Username     string     `json:"username"`
	PasswordHash string     `json:"-"`
	Role         string     `json:"role"`
	CreatedAt    time.Time  `json:"created_at"`
	LastLogin    *time.Time `json:"last_login"`
	Permissions  []string   `json:"permissions,omitempty"`
}

// PagePermission 页面权限
type PagePermission struct {
	UserID  int64  `json:"user_id"`
	PageKey string `json:"page_key"`
}

// AuditLog 审计日志
type AuditLog struct {
	ID        int64     `json:"id"`
	UserID    *int64    `json:"user_id"`
	Username  string    `json:"username"`
	Action    string    `json:"action"`
	Target    string    `json:"target"`
	Detail    string    `json:"detail"`
	Timestamp time.Time `json:"timestamp"`
}

// AIChannel AI 渠道配置
type AIChannel struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	ApiURL    string    `json:"api_url"`
	ApiKey    string    `json:"api_key,omitempty"`
	ModelList []string  `json:"model_list"`
	IsDefault bool      `json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
	CreatedBy *int64    `json:"created_by,omitempty"`
}

// AIChannelRow 数据库行（model_list 为 JSON 字符串）
type AIChannelRow struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	ApiURL    string    `json:"api_url"`
	ApiKey    string    `json:"api_key"`
	ModelList string    `json:"model_list"`
	IsDefault int       `json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
	CreatedBy *int64    `json:"created_by"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token string        `json:"token"`
	User  UserWithPerms `json:"user"`
}

// UserWithPerms 带权限的用户信息
type UserWithPerms struct {
	ID          int64      `json:"id"`
	Username    string     `json:"username"`
	Role        string     `json:"role"`
	Permissions []string   `json:"permissions"`
	CreatedAt   time.Time  `json:"created_at,omitempty"`
	LastLogin   *time.Time `json:"last_login,omitempty"`
}

// CreateUserRequest 创建用户请求
type CreateUserRequest struct {
	Username    string   `json:"username" binding:"required"`
	Password    string   `json:"password" binding:"required"`
	Role        string   `json:"role"`
	Permissions []string `json:"permissions"`
}

// ResetPasswordRequest 重置密码请求
type ResetPasswordRequest struct {
	Password string `json:"password" binding:"required"`
}

// UpdatePermissionsRequest 更新权限请求
type UpdatePermissionsRequest struct {
	Permissions []string `json:"permissions" binding:"required"`
}

// AIChannelRequest 创建/更新 AI 渠道请求
type AIChannelRequest struct {
	Name      string   `json:"name"`
	ApiURL    string   `json:"api_url"`
	ApiKey    string   `json:"api_key"`
	ModelList []string `json:"model_list"`
}

// LogQueryParams 日志查询参数
type LogQueryParams struct {
	Page      int    `form:"page,default=1"`
	Limit     int    `form:"limit,default=50"`
	Action    string `form:"action"`
	Username  string `form:"username"`
	StartDate string `form:"start_date"`
	EndDate   string `form:"end_date"`
}

// LogQueryResult 日志查询结果
type LogQueryResult struct {
	Total int64      `json:"total"`
	Page  int        `json:"page"`
	Limit int        `json:"limit"`
	Rows  []AuditLog `json:"rows"`
}

// PageSnapshot data-i18n 快照
type PageSnapshot struct {
	HTMLFile string                 `json:"htmlFile"`
	Count    int                    `json:"count"`
	Snapshot map[string]interface{} `json:"snapshot"`
}
