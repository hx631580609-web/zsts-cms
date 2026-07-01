package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// pageKeyToHTML pageKey → HTML 文件名映射
var pageKeyToHTML = map[string]string{
	"home":       "index.html",
	"about":      "about.html",
	"visa":       "visa.html",
	"saudi-visa": "saudi-visa.html",
	"enterprise": "enterprise.html",
	"transport":  "transport.html",
	"insurance":  "insurance.html",
	"inspection": "inspection.html",
}

// HTML 实体解码映射
var htmlEntities = map[string]string{
	"&nbsp;": " ",
	"&amp;":  "&",
	"&lt;":   "<",
	"&gt;":   ">",
	"&quot;": "\"",
}

// 预编译正则（RE2 不支持 \1 反向引用，改用通用闭合标签匹配）
var (
	// 匹配文本内容: <tag data-i18n="key">文本</tag>
	reText = regexp.MustCompile(`(?s)<([a-zA-Z][a-zA-Z0-9]*)[^>]*data-i18n="([a-zA-Z0-9_.\-]+)"[^>]*>(.*?)</[a-zA-Z][a-zA-Z0-9]*>`)
	// 匹配 img 标签
	reImg = regexp.MustCompile(`<img[^>]*data-i18n="([a-zA-Z0-9_.\-]+)"[^>]*src="([^"]*)"[^>]*/?>`)
	reImg2 = regexp.MustCompile(`<img[^>]*src="([^"]*)"[^>]*data-i18n="([a-zA-Z0-9_.\-]+)"[^>]*/?>`)
	// 匹配 background-image
	reBg1 = regexp.MustCompile(`<([a-zA-Z][a-zA-Z0-9]*)[^>]*data-i18n="([a-zA-Z0-9_.\-]+)"[^>]*background-image\s*:\s*url\(([^)]+)\)[^>]*>`)
	reBg2 = regexp.MustCompile(`<([a-zA-Z][a-zA-Z0-9]*)[^>]*style="[^"]*background-image\s*:\s*url\(([^)]+)\)[^"]*"[^>]*data-i18n="([a-zA-Z0-9_.\-]+)"[^>]*>`)
	// 辅助
	reBr  = regexp.MustCompile(`<br\s*/?>`)
	reTag = regexp.MustCompile(`<[^>]+>`)
)

// GenerateSnapshot 从 HTML 文件提取可编辑内容快照
func GenerateSnapshot(pageKey string) (map[string]interface{}, error) {
	htmlFile, ok := pageKeyToHTML[pageKey]
	if !ok {
		htmlFile = pageKey + ".html"
	}

	htmlPath := filepath.Join(projectRoot, htmlFile)
	if _, err := os.Stat(htmlPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("HTML 文件不存在: %s", htmlFile)
	}

	htmlBytes, err := os.ReadFile(htmlPath)
	if err != nil {
		return nil, err
	}

	html := string(htmlBytes)
	snapshot := make(map[string]interface{})

	// 1. 匹配文本内容: <tag data-i18n="key">文本</tag>
	textMatches := reText.FindAllStringSubmatch(html, -1)
	for _, m := range textMatches {
		key := m[2]
		if _, exists := snapshot[key]; exists {
			continue
		}
		inner := m[3]
		// 处理 <br> 换行
		inner = reBr.ReplaceAllString(inner, "\n")
		// 去掉内嵌 HTML 标签
		inner = reTag.ReplaceAllString(inner, "")
		// HTML 实体解码
		inner = decodeHTMLEntities(inner)
		inner = strings.TrimSpace(inner)
		if inner != "" {
			snapshot[key] = map[string]interface{}{"zh": inner, "en": ""}
		}
	}

	// 2. 匹配 img 标签: <img data-i18n="key" src="...">
	imgMatches := reImg.FindAllStringSubmatch(html, -1)
	for _, m := range imgMatches {
		key := m[1]
		if _, exists := snapshot[key]; exists {
			continue
		}
		if m[2] != "" {
			snapshot[key] = m[2]
		}
	}
	// img 标签 src 在前、data-i18n 在后
	imgMatches2 := reImg2.FindAllStringSubmatch(html, -1)
	for _, m := range imgMatches2 {
		key := m[2]
		if _, exists := snapshot[key]; exists {
			continue
		}
		if m[1] != "" {
			snapshot[key] = m[1]
		}
	}

	// 3. 匹配 background-image（data-i18n 在前）
	bgMatches := reBg1.FindAllStringSubmatch(html, -1)
	for _, m := range bgMatches {
		key := m[2]
		if _, exists := snapshot[key]; exists {
			continue
		}
		url := strings.Trim(m[3], `'"`)
		url = strings.TrimSpace(url)
		if url != "" {
			snapshot[key] = url
		}
	}

	// 4. 匹配 background-image（style 在前）
	bgMatches2 := reBg2.FindAllStringSubmatch(html, -1)
	for _, m := range bgMatches2 {
		key := m[3]
		if _, exists := snapshot[key]; exists {
			continue
		}
		url := strings.Trim(m[2], `'"`)
		url = strings.TrimSpace(url)
		if url != "" {
			snapshot[key] = url
		}
	}

	return snapshot, nil
}

// PageSnapshotHandler GET /api/page-snapshot/:pageKey
func PageSnapshotHandler(c *gin.Context) {
	pageKey := c.Param("pageKey")

	snapshot, err := GenerateSnapshot(pageKey)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count":    len(snapshot),
		"snapshot": snapshot,
	})
}

// decodeHTMLEntities 解码常见 HTML 实体
func decodeHTMLEntities(s string) string {
	for entity, char := range htmlEntities {
		s = strings.ReplaceAll(s, entity, char)
	}
	return s
}
