package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cms-server-go/middleware"

	"github.com/gin-gonic/gin"
)

var uploadDir string

// allowedExtensions 允许的图片扩展名
var allowedExtensions = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".svg": true,
}

// InitUploadDir 初始化上传目录
func InitUploadDir(baseDir string) {
	uploadDir = filepath.Join(baseDir, "uploads", "images")
	os.MkdirAll(uploadDir, 0755)
}

// UploadHandler POST /api/upload
func UploadHandler(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未选择文件"})
		return
	}

	// 验证扩展名
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExtensions[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "不支持的图片格式"})
		return
	}

	// 验证文件大小（5MB）
	if file.Size > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "文件大小超过5MB限制"})
		return
	}

	if ext == "" {
		ext = ".png"
	}

	// 生成唯一文件名
	filename := fmt.Sprintf("img_%d%s%s", time.Now().UnixMilli(), randomStr(6), ext)
	dst := filepath.Join(uploadDir, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "文件保存失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"url":      "/uploads/images/" + filename,
		"filename": filename,
		"size":     file.Size,
	})
}

// randomStr 生成随机字符串
func randomStr(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[r.Intn(len(letters))]
	}
	return string(b)
}

// 确保 middleware 被引用
var _ = middleware.RequireAuth
