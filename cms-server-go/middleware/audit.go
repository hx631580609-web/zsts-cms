package middleware

import (
	"cms-server-go/db"
	"io"
	"log"
	"strings"

	"github.com/gin-gonic/gin"
)

// Audit 写入审计日志
func Audit(c *gin.Context, action, target, detail string) {
	userID, _ := c.Get("userID")
	username, _ := c.Get("username")

	var uid *int64
	if id, ok := userID.(int64); ok && id > 0 {
		uid = &id
	}

	uname := "anonymous"
	if u, ok := username.(string); ok && u != "" {
		uname = u
	}

	_, err := db.DB.Exec(
		"INSERT INTO audit_log (user_id, username, action, target, detail) VALUES (?, ?, ?, ?, ?)",
		uid, uname, action, target, detail,
	)
	if err != nil {
		log.Printf("[audit] 写入失败: %v", err)
	}
}

// AuditMiddleware 自动记录所有写操作（POST/PUT/DELETE）
func AuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// 只在写操作且响应成功时记录
		method := c.Request.Method
		if method == "GET" {
			return
		}
		if c.Writer.Status() >= 400 {
			return
		}

		userID, _ := c.Get("userID")
		username, _ := c.Get("username")

		var uid *int64
		if id, ok := userID.(int64); ok && id > 0 {
			uid = &id
		}

		uname := "anonymous"
		if u, ok := username.(string); ok && u != "" {
			uname = u
		}

		action := "api_" + strings.ToLower(method)
		target := c.FullPath()
		if target == "" {
			target = c.Request.URL.Path
		}

		// 限制 detail 长度
		detail := ""
		if c.Request.Body != nil {
			bodyBytes, _ := io.ReadAll(c.Request.Body)
			if len(bodyBytes) > 200 {
				detail = string(bodyBytes[:200])
			} else {
				detail = string(bodyBytes)
			}
		}

		go func() {
			_, _ = db.DB.Exec(
				"INSERT INTO audit_log (user_id, username, action, target, detail) VALUES (?, ?, ?, ?, ?)",
				uid, uname, action, target, detail,
			)
		}()
	}
}
