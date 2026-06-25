package routes

import (
	"bytes"
	"cms-server-go/db"
	"cms-server-go/middleware"
	"cms-server-go/models"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// RegisterWechatRoutes 注册微信公众号路由
func RegisterWechatRoutes(r *gin.RouterGroup) {
	// 配置管理（需认证）
	wc := r.Group("/wechat-config", middleware.RequireAuth())
	{
		wc.GET("", getWechatConfig)
		wc.PUT("", middleware.RequireSuperAdmin(), updateWechatConfig)
	}

	// 草稿箱推送（需认证）
	r.POST("/wechat/draft", middleware.RequireAuth(), pushWechatDraft)
}

// ── 配置管理 ──

func getWechatConfig(c *gin.Context) {
	var cfg models.WechatConfig
	err := db.DB.QueryRow("SELECT id, app_id, app_secret, updated_at FROM wechat_config LIMIT 1").
		Scan(&cfg.ID, &cfg.AppID, &cfg.AppSecret, &cfg.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusOK, models.WechatConfig{})
		return
	}
	c.JSON(http.StatusOK, cfg)
}

func updateWechatConfig(c *gin.Context) {
	var req models.WechatConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据错误"})
		return
	}

	_, err := db.DB.Exec("UPDATE wechat_config SET app_id = ?, app_secret = ?", req.AppID, req.AppSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	middleware.Audit(c, "update_wechat_config", "wechat", "")
	c.JSON(http.StatusOK, gin.H{"message": "微信公众号配置已保存"})
}

// ── 微信 API 辅助 ──

// wechatAccessToken 缓存 access_token
var wechatAccessToken struct {
	Token     string
	ExpiresAt int64 // unix timestamp
}

func getWechatAccessToken(appID, appSecret string) (string, error) {
	now := time.Now().Unix()
	if wechatAccessToken.Token != "" && now < wechatAccessToken.ExpiresAt-60 {
		return wechatAccessToken.Token, nil
	}

	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s", appID, appSecret)
	resp, err := http.Get(url)
	if err != nil {
		return "", fmt.Errorf("请求微信 token 失败: %v", err)
	}
	defer resp.Body.Close()

	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		ErrCode     int    `json:"errcode"`
		ErrMsg      string `json:"errmsg"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析微信 token 响应失败: %v", err)
	}
	if result.ErrCode != 0 {
		return "", fmt.Errorf("微信返回错误: %s (code=%d)", result.ErrMsg, result.ErrCode)
	}

	wechatAccessToken.Token = result.AccessToken
	wechatAccessToken.ExpiresAt = now + int64(result.ExpiresIn)
	return result.AccessToken, nil
}

// uploadThumbToWechat 上传缩略图到微信，返回 media_id
func uploadThumbToWechat(accessToken, imageURL string) (string, error) {
	// 下载图片
	resp, err := http.Get(imageURL)
	if err != nil {
		return "", fmt.Errorf("下载图片失败: %v", err)
	}
	defer resp.Body.Close()

	imgData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取图片数据失败: %v", err)
	}

	// 构建 multipart 表单
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("media", "thumb.jpg")
	if err != nil {
		return "", fmt.Errorf("创建表单文件失败: %v", err)
	}
	part.Write(imgData)
	writer.Close()

	// 上传到微信
	uploadURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=%s", accessToken)
	req, err := http.NewRequest("POST", uploadURL, &buf)
	if err != nil {
		return "", fmt.Errorf("创建上传请求失败: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	uploadResp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("上传到微信失败: %v", err)
	}
	defer uploadResp.Body.Close()

	var result struct {
		URL     string `json:"url"`
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.NewDecoder(uploadResp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析上传响应失败: %v", err)
	}
	if result.ErrCode != 0 {
		return "", fmt.Errorf("微信上传返回错误: %s (code=%d)", result.ErrMsg, result.ErrCode)
	}

	// uploadimg 返回的是 url，但 draft 需要 media_id
	// 需要通过 material/batchget 或其他方式获取 media_id
	// 这里使用 material/add_material 接口
	return uploadMaterialToWechat(accessToken, imageURL)
}

// uploadMaterialToWechat 上传永久素材，返回 media_id
func uploadMaterialToWechat(accessToken, imageURL string) (string, error) {
	resp, err := http.Get(imageURL)
	if err != nil {
		return "", fmt.Errorf("下载图片失败: %v", err)
	}
	defer resp.Body.Close()

	imgData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("读取图片数据失败: %v", err)
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("media", "thumb.jpg")
	if err != nil {
		return "", fmt.Errorf("创建表单文件失败: %v", err)
	}
	part.Write(imgData)
	// 添加 description 字段（永久素材上传需要）
	writer.WriteField("description", `{"title":"thumb","introduction":"thumb"}`)
	writer.Close()

	uploadURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=%s&type=image", accessToken)
	req, err := http.NewRequest("POST", uploadURL, &buf)
	if err != nil {
		return "", fmt.Errorf("创建上传请求失败: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	uploadResp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("上传到微信失败: %v", err)
	}
	defer uploadResp.Body.Close()

	var result struct {
		MediaID string `json:"media_id"`
		URL     string `json:"url"`
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.NewDecoder(uploadResp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析上传响应失败: %v", err)
	}
	if result.ErrCode != 0 {
		return "", fmt.Errorf("微信上传素材返回错误: %s (code=%d)", result.ErrMsg, result.ErrCode)
	}

	return result.MediaID, nil
}

// ── 推送草稿箱 ──

func pushWechatDraft(c *gin.Context) {
	var req models.WechatDraftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求数据错误: " + err.Error()})
		return
	}

	// 读取微信公众号配置
	var cfg models.WechatConfig
	err := db.DB.QueryRow("SELECT id, app_id, app_secret, updated_at FROM wechat_config LIMIT 1").
		Scan(&cfg.ID, &cfg.AppID, &cfg.AppSecret, &cfg.UpdatedAt)
	if err != nil || cfg.AppID == "" || cfg.AppSecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "微信公众号未配置，请先在后台完成配置"})
		return
	}

	// 获取 access_token
	accessToken, err := getWechatAccessToken(cfg.AppID, cfg.AppSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 上传缩略图（如果有图片 URL）
	thumbMediaID := req.Thumb
	if req.Thumb == "" && req.Content != "" {
		// 尝试从 HTML 内容中提取第一张图片
		// 简单匹配 <img src="xxx"> 或 src="xxx"
		// 这里不做复杂解析，如果没提供 thumb_media_id 就跳过
	}
	if req.Thumb != "" {
		mediaID, err := uploadMaterialToWechat(accessToken, req.Thumb)
		if err != nil {
			// 缩略图上传失败不阻断，继续推送
			fmt.Printf("[wechat] 缩略图上传失败: %v\n", err)
		} else {
			thumbMediaID = mediaID
		}
	}
	if thumbMediaID == "" {
		thumbMediaID = "thumb" // 微信要求必须有 thumb_media_id
	}

	// 构建草稿内容
	draftBody := map[string]interface{}{
		"articles": []map[string]interface{}{
			{
				"title":                 req.Title,
				"author":                req.Author,
				"digest":                req.Digest,
				"content":               req.Content,
				"thumb_media_id":        thumbMediaID,
				"need_open_comment":     0,
				"only_fans_can_comment": 0,
			},
		},
	}

	bodyJSON, _ := json.Marshal(draftBody)
	draftURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/draft/add?access_token=%s", accessToken)

	draftResp, err := http.Post(draftURL, "application/json", bytes.NewReader(bodyJSON))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "推送草稿箱失败: " + err.Error()})
		return
	}
	defer draftResp.Body.Close()

	var result struct {
		MediaID string `json:"media_id"`
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.NewDecoder(draftResp.Body).Decode(&result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "解析微信响应失败: " + err.Error()})
		return
	}

	if result.ErrCode != 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   fmt.Sprintf("微信返回错误: %s (code=%d)", result.ErrMsg, result.ErrCode),
			"errcode": result.ErrCode,
			"errmsg":  result.ErrMsg,
		})
		return
	}

	middleware.Audit(c, "push_wechat_draft", "draft:"+req.Title, "")
	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"media_id": result.MediaID,
		"message":  "已成功推送到微信公众号草稿箱",
	})
}
