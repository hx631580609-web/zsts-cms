package routes

import (
	"cms-server-go/db"
	"cms-server-go/middleware"
	"cms-server-go/models"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// RegisterAIChannelRoutes 注册 AI 渠道路由
func RegisterAIChannelRoutes(r *gin.RouterGroup) {
	channels := r.Group("/ai-channels", middleware.RequireAuth())
	{
		channels.GET("", listChannels)
		channels.POST("", middleware.RequireSuperAdmin(), createChannel)
		channels.PUT("/:id", middleware.RequireSuperAdmin(), updateChannel)
		channels.PUT("/:id/set-default", middleware.RequireSuperAdmin(), setDefaultChannel)
		channels.DELETE("/:id", middleware.RequireSuperAdmin(), deleteChannel)
	}
}

// listChannels GET /api/ai-channels
func listChannels(c *gin.Context) {
	rows, err := db.DB.Query("SELECT id, name, api_url, api_key, model_list, default_model, is_default, created_at, created_by FROM ai_channels ORDER BY id")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var result []models.AIChannel
	for rows.Next() {
		var r models.AIChannelRow
		if err := rows.Scan(&r.ID, &r.Name, &r.ApiURL, &r.ApiKey, &r.ModelList, &r.DefaultModel, &r.IsDefault, &r.CreatedAt, &r.CreatedBy); err != nil {
			continue
		}

		// 解析 model_list JSON
		var modelList []string
		if r.ModelList != "" {
			json.Unmarshal([]byte(r.ModelList), &modelList)
		}
		if modelList == nil {
			modelList = []string{}
		}

		result = append(result, models.AIChannel{
			ID:           r.ID,
			Name:         r.Name,
			ApiURL:       r.ApiURL,
			ApiKey:       r.ApiKey,
			ModelList:    modelList,
			DefaultModel: r.DefaultModel,
			IsDefault:    r.IsDefault == 1,
			CreatedAt:    r.CreatedAt,
			CreatedBy:    r.CreatedBy,
		})
	}

	if result == nil {
		result = []models.AIChannel{}
	}
	c.JSON(http.StatusOK, result)
}

// createChannel POST /api/ai-channels
func createChannel(c *gin.Context) {
	var req models.AIChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据错误"})
		return
	}

	if req.Name == "" || req.ApiURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name 和 api_url 不能为空"})
		return
	}

	apiKey := req.ApiKey
	modelListJSON, _ := json.Marshal(req.ModelList)
	if req.ModelList == nil {
		modelListJSON = []byte("[]")
	}

	userID, _ := c.Get("userID")
	uid, _ := userID.(int64)

	result, err := db.DB.Exec(
		"INSERT INTO ai_channels (name, api_url, api_key, model_list, default_model, created_by) VALUES (?, ?, ?, ?, ?, ?)",
		req.Name, req.ApiURL, apiKey, string(modelListJSON), req.DefaultModel, uid,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	id, _ := result.LastInsertId()
	middleware.Audit(c, "create_ai_channel", "channel:"+req.Name, "")
	c.JSON(http.StatusOK, gin.H{"id": id})
}

// updateChannel PUT /api/ai-channels/:id
func updateChannel(c *gin.Context) {
	var req models.AIChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据错误"})
		return
	}

	apiKey := req.ApiKey
	modelListJSON, _ := json.Marshal(req.ModelList)
	if req.ModelList == nil {
		modelListJSON = []byte("[]")
	}

	_, err := db.DB.Exec(
		"UPDATE ai_channels SET name = ?, api_url = ?, api_key = ?, model_list = ?, default_model = ? WHERE id = ?",
		req.Name, req.ApiURL, apiKey, string(modelListJSON), req.DefaultModel, c.Param("id"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	middleware.Audit(c, "update_ai_channel", "channel:id:"+c.Param("id"), "")
	c.JSON(http.StatusOK, gin.H{"message": "渠道已更新"})
}

// setDefaultChannel PUT /api/ai-channels/:id/set-default
func setDefaultChannel(c *gin.Context) {
	// 清除所有默认
	db.DB.Exec("UPDATE ai_channels SET is_default = 0")
	// 设置新的默认
	db.DB.Exec("UPDATE ai_channels SET is_default = 1 WHERE id = ?", c.Param("id"))

	middleware.Audit(c, "set_default_ai_channel", "channel:id:"+c.Param("id"), "")
	c.JSON(http.StatusOK, gin.H{"message": "默认渠道已设置"})
}

// deleteChannel DELETE /api/ai-channels/:id
func deleteChannel(c *gin.Context) {
	db.DB.Exec("DELETE FROM ai_channels WHERE id = ?", c.Param("id"))
	middleware.Audit(c, "delete_ai_channel", "channel:id:"+c.Param("id"), "")
	c.JSON(http.StatusOK, gin.H{"message": "渠道已删除"})
}

// 确保 strconv 被引用
var _ = strconv.Itoa
