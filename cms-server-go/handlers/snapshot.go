package handlers

import (
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

// PageSnapshotHandler GET /api/page-snapshot/:pageKey
func PageSnapshotHandler(c *gin.Context) {
	pageKey := c.Param("pageKey")

	htmlFile, ok := pageKeyToHTML[pageKey]
	if !ok {
		htmlFile = pageKey + ".html"
	}

	htmlPath := filepath.Join(projectRoot, htmlFile)
	if _, err := os.Stat(htmlPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "HTML 文件不存在"})
		return
	}

	htmlBytes, err := os.ReadFile(htmlPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	html := string(htmlBytes)
	snapshot := make(map[string]interface{})

	// 1. 匹配文本内容: <tag data-i18n="key">文本</tag>
	textRe := regexp.MustCompile(`<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bdata-i18n="([a-zA-Z0-9_.\-]+)"[^>]*>([\s\S]*?)</\1>`)
	textMatches := textRe.FindAllStringSubmatch(html, -1)
	for _, m := range textMatches {
		key := m[2]
		if _, exists := snapshot[key]; exists {
			continue
		}
		inner := m[3]
		// 处理 <br> 换行
		brRe := regexp.MustCompile(`<br\s*/?>`)
		inner = brRe.ReplaceAllString(inner, "\n")
		// 去掉内嵌 HTML 标签
		tagRe := regexp.MustCompile(`<[^>]+>`)
		inner = tagRe.ReplaceAllString(inner, "")
		// HTML 实体解码
		inner = decodeHTMLEntities(inner)
		inner = strings.TrimSpace(inner)
		if inner != "" {
			snapshot[key] = map[string]string{"zh": inner, "en": ""}
		}
	}

	// 2. 匹配 img 标签: <img data-i18n="key" src="...">
	imgRe := regexp.MustCompile(`<img\b[^>]*\bdata-i18n="([a-zA-Z0-9_.\-]+)"[^>]*\bsrc="([^"]*)"[^>]*/?>`)
	imgMatches := imgRe.FindAllStringSubmatch(html, -1)
	for _, m := range imgMatches {
		key := m[1]
		if _, exists := snapshot[key]; exists {
			continue
		}
		if m[2] != "" {
			snapshot[key] = m[2]
		}
	}

	// 3. 匹配 background-image（data-i18n 在后）: style="...background-image:url(...)" data-i18n="key"
	bgRe := regexp.MustCompile(`<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bdata-i18n="([a-zA-Z0-9_.\-]+)"[^>]*\bbackground-image\s*:\s*url\(([^)]+)\)[^>]*>`)
	bgMatches := bgRe.FindAllStringSubmatch(html, -1)
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

	// 4. 匹配 background-image（style 在前）: style="background-image:url(...)" ... data-i18n="key"
	bgRe2 := regexp.MustCompile(`<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\bstyle="[^"]*background-image\s*:\s*url\(([^)]+)\)[^"]*"[^>]*\bdata-i18n="([a-zA-Z0-9_.\-]+)"[^>]*>`)
	bgMatches2 := bgRe2.FindAllStringSubmatch(html, -1)
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

	c.JSON(http.StatusOK, gin.H{
		"htmlFile": htmlFile,
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
