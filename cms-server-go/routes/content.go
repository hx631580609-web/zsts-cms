package routes

import (
	"cms-server-go/db"
	"cms-server-go/middleware"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

var (
	contentDir string
	globalDir  string
)

// 合法的页面 key 列表
var validPageKeys = map[string]bool{
	"home": true, "about": true, "visa": true, "saudi-visa": true,
	"enterprise": true, "transport": true, "insurance": true, "inspection": true,
	"saudi-news": true,
}

// 全局配置 key
var globalKeys = map[string]bool{
	"nav": true, "footer": true, "consultation": true,
}

// InitContentDirs 初始化内容目录
func InitContentDirs(baseDir string) {
	contentDir = filepath.Join(baseDir, "content", "pages")
	globalDir = filepath.Join(baseDir, "content", "global")

	os.MkdirAll(contentDir, 0755)
	os.MkdirAll(globalDir, 0755)
}

// RegisterContentRoutes 注册内容路由
func RegisterContentRoutes(r *gin.RouterGroup) {
	content := r.Group("/content")
	{
		content.GET("/:pageKey", getContent)
		content.PUT("/:pageKey", middleware.RequireAuth(), updateContent)
	}
}

// getContent GET /api/content/:pageKey
func getContent(c *gin.Context) {
	pageKey := c.Param("pageKey")

	// 全局配置
	if globalKeys[pageKey] {
		filePath := filepath.Join(globalDir, pageKey+".json")
		data, err := os.ReadFile(filePath)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{})
			return
		}
		var result interface{}
		if json.Unmarshal(data, &result) != nil {
			c.JSON(http.StatusOK, gin.H{})
			return
		}
		c.JSON(http.StatusOK, result)
		return
	}

	if !validPageKeys[pageKey] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的页面 key: " + pageKey})
		return
	}

	filePath := filepath.Join(contentDir, pageKey+".json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{})
		return
	}
	var result interface{}
	if json.Unmarshal(data, &result) != nil {
		c.JSON(http.StatusOK, gin.H{})
		return
	}
	c.JSON(http.StatusOK, result)
}

// updateContent PUT /api/content/:pageKey
func updateContent(c *gin.Context) {
	pageKey := c.Param("pageKey")
	role, _ := c.Get("role")
	userID, _ := c.Get("userID")

	var body interface{}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 JSON 数据"})
		return
	}

	// 全局配置：仅超级管理员
	if globalKeys[pageKey] {
		if role != "super_admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "需要超级管理员权限"})
			return
		}
		filePath := filepath.Join(globalDir, pageKey+".json")
		data, _ := json.MarshalIndent(body, "", "  ")
		if err := os.WriteFile(filePath, data, 0644); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "写入失败：" + err.Error()})
			return
		}
		middleware.Audit(c, "update_global", pageKey, "")
		c.JSON(http.StatusOK, gin.H{"message": "全局配置已保存"})
		return
	}

	if !validPageKeys[pageKey] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的页面 key: " + pageKey})
		return
	}

	// 检查页面权限
	if role != "super_admin" {
		var count int
		err := db.DB.QueryRow(
			"SELECT COUNT(*) FROM page_permissions WHERE user_id = ? AND page_key = ?",
			userID, pageKey,
		).Scan(&count)
		if err != nil || count == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "无 [" + pageKey + "] 页面编辑权限"})
			return
		}
	}

	filePath := filepath.Join(contentDir, pageKey+".json")
	data, _ := json.MarshalIndent(body, "", "  ")
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "写入失败：" + err.Error()})
		return
	}

	middleware.Audit(c, "update_page", pageKey, "")
	c.JSON(http.StatusOK, gin.H{"message": "页面内容已保存"})
}
