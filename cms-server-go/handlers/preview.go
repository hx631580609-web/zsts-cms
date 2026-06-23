package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

var projectRoot string

// htmlToPageKey HTML 文件名 → CMS pageKey 映射
var htmlToPageKey = map[string]string{
	"index.html":      "home",
	"about.html":      "about",
	"visa.html":       "visa",
	"saudi-visa.html": "saudi-visa",
	"enterprise.html": "enterprise",
	"transport.html":  "transport",
	"insurance.html":  "insurance",
	"inspection.html": "inspection",
}

// InitPreview 设置项目根目录
func InitPreview(baseDir string) {
	projectRoot = baseDir
}

// PreviewClientJS 返回预览客户端 JS（禁用缓存）
func PreviewClientJS(version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		fileName := "preview-client.js"
		if version != "" {
			fileName = "preview-client-" + version + ".js"
		}
		jsPath := filepath.Join(projectRoot, "cms-server", fileName)
		data, err := os.ReadFile(jsPath)
		if err != nil {
			c.String(http.StatusNotFound, "// not found")
			return
		}

		c.Header("Content-Type", "application/javascript; charset=utf-8")
		c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
		c.Header("Pragma", "no-cache")
		c.Header("Expires", "Thu, 01 Jan 1970 00:00:00 GMT")
		c.String(http.StatusOK, string(data))
	}
}

// PreviewHandler GET /preview/*filepath
func PreviewHandler(c *gin.Context) {
	fp := c.Param("filepath")
	if fp == "" || fp == "/" {
		fp = "index.html"
	}
	// 去掉前导斜杠
	fp = strings.TrimPrefix(fp, "/")

	// 处理静态资源请求：/preview/images/* → /images/*, /preview/local-cdn/* → /local-cdn/*
	if strings.HasPrefix(fp, "images/") {
		c.File(filepath.Join(projectRoot, fp))
		return
	}
	if strings.HasPrefix(fp, "local-cdn/") {
		c.File(filepath.Join(projectRoot, fp))
		return
	}

	// 非 HTML 文件的其他静态资源也直接返回
	if !strings.HasSuffix(fp, ".html") {
		c.File(filepath.Join(projectRoot, fp))
		return
	}

	frontendPath := filepath.Join(projectRoot, fp)

	data, err := os.ReadFile(frontendPath)
	if err != nil {
		c.String(http.StatusNotFound, "页面不存在")
		return
	}

	content := string(data)

	// 修复资源相对路径
	content = strings.ReplaceAll(content, `href="local-cdn/`, `href="/local-cdn/`)
	content = strings.ReplaceAll(content, `src="local-cdn/`, `src="/local-cdn/`)
	content = strings.ReplaceAll(content, `href="images/`, `href="/images/`)
	content = strings.ReplaceAll(content, `src="images/`, `src="/images/`)

	// 注入预览标志 + pageKey
	pageKey := htmlToPageKey[fp]
	previewScript := "<script>window.CMS_PREVIEW=1;"
	if pageKey != "" {
		previewScript += fmt.Sprintf("\nwindow.CMS_PAGE_KEY='%s';", pageKey)
	}
	previewScript += "</script>"
	content = strings.Replace(content, "<head>", "<head>\n    "+previewScript, 1)

	// 注入预览客户端 JS v4
	content = strings.Replace(content, "</body>", `<script src="/preview-client-v4.js"></script></body>`, 1)

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.Header("Cache-Control", "no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	c.String(http.StatusOK, content)
}
