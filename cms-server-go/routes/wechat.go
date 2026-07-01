package routes

import (
	"bytes"
	"cms-server-go/db"
	"cms-server-go/middleware"
	"cms-server-go/models"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"regexp"
	"strings"
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

// uploadDefaultThumb 生成并上传一个默认缩略图到微信素材库
func uploadDefaultThumb(accessToken string) (string, error) {
	// 生成 300x200 的纯色 PNG 图片
	img := image.NewRGBA(image.Rect(0, 0, 300, 200))
	bgColor := color.RGBA{R: 0, G: 99, B: 65, A: 255} // 品牌绿
	for y := 0; y < 200; y++ {
		for x := 0; x < 300; x++ {
			img.Set(x, y, bgColor)
		}
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return "", fmt.Errorf("生成默认缩略图失败: %v", err)
	}

	var formBuf bytes.Buffer
	writer := multipart.NewWriter(&formBuf)
	part, err := writer.CreateFormFile("media", "default_thumb.png")
	if err != nil {
		return "", fmt.Errorf("创建表单失败: %v", err)
	}
	part.Write(buf.Bytes())
	writer.Close()

	uploadURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=%s&type=image", accessToken)
	req, err := http.NewRequest("POST", uploadURL, &formBuf)
	if err != nil {
		return "", fmt.Errorf("创建上传请求失败: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	uploadResp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("上传默认缩略图失败: %v", err)
	}
	defer uploadResp.Body.Close()

	var result struct {
		MediaID string `json:"media_id"`
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.NewDecoder(uploadResp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("解析响应失败: %v", err)
	}
	if result.ErrCode != 0 {
		return "", fmt.Errorf("微信返回错误: %s (code=%d)", result.ErrMsg, result.ErrCode)
	}

	return result.MediaID, nil
}

// uploadMaterialToWechatWithURL 上传永久素材到微信，返回 media_id 和 cdn_url
func uploadMaterialToWechatWithURL(accessToken, imageURL string) (mediaID, cdnURL string, err error) {
	resp, err := http.Get(imageURL)
	if err != nil {
		return "", "", fmt.Errorf("下载图片失败: %v", err)
	}
	defer resp.Body.Close()

	imgData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("读取图片数据失败: %v", err)
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("media", "thumb.jpg")
	if err != nil {
		return "", "", fmt.Errorf("创建表单文件失败: %v", err)
	}
	part.Write(imgData)
	writer.Close()

	uploadURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=%s&type=image", accessToken)
	req, err := http.NewRequest("POST", uploadURL, &buf)
	if err != nil {
		return "", "", fmt.Errorf("创建上传请求失败: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	uploadResp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("上传失败: %v", err)
	}
	defer uploadResp.Body.Close()

	var result struct {
		MediaID string `json:"media_id"`
		URL     string `json:"url"`
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.NewDecoder(uploadResp.Body).Decode(&result); err != nil {
		return "", "", fmt.Errorf("解析响应失败: %v", err)
	}
	if result.ErrCode != 0 {
		return "", "", fmt.Errorf("微信返回错误: %s (code=%d)", result.ErrMsg, result.ErrCode)
	}

	return result.MediaID, result.URL, nil
}

// uploadDataURLToWechat 上传 base64 data URL 图片到微信素材库
func uploadDataURLToWechat(accessToken, dataURL string) (mediaID, cdnURL string, err error) {
	// 解析 data:image/png;base64,xxxxx
	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("无效的 data URL 格式")
	}
	base64Str := parts[1]
	imgData, err := base64.StdEncoding.DecodeString(base64Str)
	if err != nil {
		return "", "", fmt.Errorf("base64 解码失败: %v", err)
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("media", "image.png")
	if err != nil {
		return "", "", fmt.Errorf("创建表单失败: %v", err)
	}
	part.Write(imgData)
	writer.Close()

	uploadURL := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=%s&type=image", accessToken)
	req, err := http.NewRequest("POST", uploadURL, &buf)
	if err != nil {
		return "", "", fmt.Errorf("创建上传请求失败: %v", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	uploadResp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("上传失败: %v", err)
	}
	defer uploadResp.Body.Close()

	var result struct {
		MediaID string `json:"media_id"`
		URL     string `json:"url"`
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	if err := json.NewDecoder(uploadResp.Body).Decode(&result); err != nil {
		return "", "", fmt.Errorf("解析响应失败: %v", err)
	}
	if result.ErrCode != 0 {
		return "", "", fmt.Errorf("微信返回错误: %s (code=%d)", result.ErrMsg, result.ErrCode)
	}

	return result.MediaID, result.URL, nil
}

// processContentImages 处理 HTML 内容中的图片：上传到微信素材库并替换为微信 CDN URL
func processContentImages(accessToken, htmlContent, baseURL string) (string, error) {
	re := regexp.MustCompile(`<img[^>]+src=["']([^"']+)["'][^>]*>`)
	matches := re.FindAllStringSubmatchIndex(htmlContent, -1)
	if len(matches) == 0 {
		return htmlContent, nil
	}

	var result []byte
	lastEnd := 0
	for _, m := range matches {
		srcStart, srcEnd := m[2], m[3]
		src := htmlContent[srcStart:srcEnd]

		imageURL := src
		isDataURL := strings.HasPrefix(src, "data:")
		if strings.HasPrefix(src, "/") {
			imageURL = strings.TrimRight(baseURL, "/") + src
		} else if !isDataURL && !strings.HasPrefix(src, "http") {
			imageURL = strings.TrimRight(baseURL, "/") + "/" + src
		}

		var wechatURL string
		if isDataURL {
			// base64 data URL: 解码后上传
			_, url, err := uploadDataURLToWechat(accessToken, src)
			if err != nil {
				fmt.Printf("[wechat] base64图片上传失败: %v\n", err)
				result = append(result, []byte(htmlContent[lastEnd:m[1]])...)
				lastEnd = m[1]
				continue
			}
			wechatURL = url
		} else if strings.HasPrefix(imageURL, "http") {
			_, url, err := uploadMaterialToWechatWithURL(accessToken, imageURL)
			if err != nil || url == "" {
				fmt.Printf("[wechat] 图片上传失败 %s: %v\n", imageURL, err)
				result = append(result, []byte(htmlContent[lastEnd:m[1]])...)
				lastEnd = m[1]
				continue
			}
			wechatURL = url
		} else {
			result = append(result, []byte(htmlContent[lastEnd:m[1]])...)
			lastEnd = m[1]
			continue
		}

		result = append(result, []byte(htmlContent[lastEnd:srcStart])...)
		result = append(result, []byte(wechatURL)...)
		lastEnd = srcEnd
	}
	result = append(result, []byte(htmlContent[lastEnd:])...)
	return string(result), nil
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

	// CMS_PUBLIC_URL 应配置为公网可访问的地址
	publicURL := os.Getenv("CMS_PUBLIC_URL")
	if publicURL == "" {
		publicURL = "http://localhost:3001"
	}

	// 上传缩略图（支持 HTTP / base64 / 相对路径）
	thumbMediaID := ""
	hasCover := false

	if req.Thumb != "" {
		isDataURL := strings.HasPrefix(req.Thumb, "data:")
		isHTTP := strings.HasPrefix(req.Thumb, "http")
		isRelative := strings.HasPrefix(req.Thumb, "/")

		thumbURL := req.Thumb
		if isRelative {
			thumbURL = strings.TrimRight(publicURL, "/") + thumbURL
			isHTTP = true
		}

		if isDataURL {
			mediaID, _, err := uploadDataURLToWechat(accessToken, thumbURL)
			if err != nil {
				fmt.Printf("[wechat] 缩略图(base64)上传失败: %v\n", err)
			} else {
				thumbMediaID = mediaID
				hasCover = true
				fmt.Printf("[wechat] 缩略图(base64)上传成功 media_id=%s\n", mediaID)
			}
		} else if isHTTP {
			mediaID, _, err := uploadMaterialToWechatWithURL(accessToken, thumbURL)
			if err != nil {
				fmt.Printf("[wechat] 缩略图上传失败: %v\n", err)
			} else {
				thumbMediaID = mediaID
				hasCover = true
				fmt.Printf("[wechat] 缩略图上传成功 media_id=%s\n", mediaID)
			}
		}
	}

	if !hasCover {
		// 无有效缩略图时，优先从内容中提取第一张图片作为封面
		fmt.Println("[wechat] 未提供有效封面，尝试从内容提取第一张图...")
		re := regexp.MustCompile(`<img[^>]+src=["']([^"']+)["']`)
		if match := re.FindStringSubmatch(req.Content); len(match) > 1 {
			extractedURL := match[1]
			fmt.Printf("[wechat] 从内容提取到图片: %s\n", extractedURL)
			// 上传提取到的图片到微信
			if strings.HasPrefix(extractedURL, "data:") {
				mid, _, err := uploadDataURLToWechat(accessToken, extractedURL)
				if err == nil {
					thumbMediaID = mid
					hasCover = true
				} else {
					fmt.Printf("[wechat] 内容图片(data)上传失败: %v\n", err)
				}
			} else if strings.HasPrefix(extractedURL, "/") {
				fullURL := strings.TrimRight(publicURL, "/") + extractedURL
				mid, _, err := uploadMaterialToWechatWithURL(accessToken, fullURL)
				if err == nil {
					thumbMediaID = mid
					hasCover = true
				} else {
					fmt.Printf("[wechat] 内容图片(相对路径)上传失败: %v\n", err)
				}
			} else if strings.HasPrefix(extractedURL, "http") {
				mid, _, err := uploadMaterialToWechatWithURL(accessToken, extractedURL)
				if err == nil {
					thumbMediaID = mid
					hasCover = true
				} else {
					fmt.Printf("[wechat] 内容图片(http)上传失败: %v\n", err)
				}
			}
		} else {
			fmt.Println("[wechat] 内容中未找到 <img> 标签")
		}
	}

	if !hasCover {
		// 无缩略图时，上传一个默认封面
		fmt.Println("[wechat] 使用默认封面")
		defaultThumb, err := uploadDefaultThumb(accessToken)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "需要提供 thumb_media_id（缩略图），自动生成默认封面失败: " + err.Error()})
			return
		}
		thumbMediaID = defaultThumb
	}

	// 处理内容中的图片：上传到微信素材库并替换 URL
	processedContent, imgErr := processContentImages(accessToken, req.Content, publicURL)
	if imgErr != nil {
		fmt.Printf("[wechat] 处理内容图片失败: %v\n", imgErr)
		processedContent = req.Content // 降级使用原始内容
	}

	// 构建草稿内容
	draftBody := map[string]interface{}{
		"articles": []map[string]interface{}{
			{
				"title":                 req.Title,
				"author":                req.Author,
				"digest":                req.Digest,
				"content":               processedContent,
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
