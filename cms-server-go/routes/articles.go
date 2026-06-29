package routes

import (
	"cms-server-go/db"
	"cms-server-go/middleware"
	"cms-server-go/models"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// RegisterArticleRoutes 注册文章路由
func RegisterArticleRoutes(r *gin.RouterGroup) {
	articles := r.Group("/articles")
	{
		// 公开接口：获取已发布的文章列表（用于官网展示）
		articles.GET("/published", getPublishedArticles)
		// 公开接口：获取单篇文章详情
		articles.GET("/:id", getArticle)

		// 需要认证的接口
		articles.GET("", middleware.RequireAuth(), listArticles)
		articles.GET("/stats", middleware.RequireAuth(), getArticleStats)
		articles.POST("", middleware.RequireAuth(), createArticle)
		articles.PUT("/:id", middleware.RequireAuth(), updateArticle)
		articles.PUT("/:id/publish", middleware.RequireAuth(), publishArticle)
		articles.DELETE("/:id", middleware.RequireAuth(), deleteArticle)
	}
}

// listArticles GET /api/articles
// 获取文章列表（支持分页、搜索、状态筛选）
func listArticles(c *gin.Context) {
	page := 1
	limit := 20
	status := ""
	search := ""

	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	status = c.Query("status")
	search = c.Query("search")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	offset := (page - 1) * limit

	// 构建查询
	where := "WHERE 1=1"
	args := []interface{}{}

	if status != "" {
		where += " AND status = ?"
		args = append(args, status)
	}
	if search != "" {
		where += " AND (title LIKE ? OR summary LIKE ? OR tags LIKE ?)"
		searchPattern := "%" + search + "%"
		args = append(args, searchPattern, searchPattern, searchPattern)
	}

	// 查询总数
	var total int64
	countSQL := "SELECT COUNT(*) FROM articles " + where
	if err := db.DB.QueryRow(countSQL, args...).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}

	// 查询列表
	querySQL := "SELECT id, title, summary, tags, cover_image, source, word_count, status, author, created_at, updated_at FROM articles " + where + " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	queryArgs := append(args, limit, offset)

	rows, err := db.DB.Query(querySQL, queryArgs...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	var articles []models.Article
	for rows.Next() {
		var a models.Article
		if err := rows.Scan(&a.ID, &a.Title, &a.Summary, &a.Tags, &a.CoverImage, &a.Source, &a.WordCount, &a.Status, &a.Author, &a.CreatedAt, &a.UpdatedAt); err != nil {
			continue
		}
		articles = append(articles, a)
	}

	if articles == nil {
		articles = []models.Article{}
	}

	c.JSON(http.StatusOK, gin.H{
		"total": total,
		"page":  page,
		"limit": limit,
		"rows":  articles,
	})
}

// getPublishedArticles GET /api/articles/published
// 获取已发布的文章列表（公开接口，用于官网展示）
func getPublishedArticles(c *gin.Context) {
	page := 1
	limit := 10

	if p := c.Query("page"); p != "" {
		fmt.Sscanf(p, "%d", &page)
	}
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 50 {
		limit = 10
	}

	offset := (page - 1) * limit

	var total int64
	db.DB.QueryRow("SELECT COUNT(*) FROM articles WHERE status = 'published'").Scan(&total)

	rows, err := db.DB.Query(
		"SELECT id, title, summary, tags, cover_image, source, word_count, status, author, created_at, updated_at FROM articles WHERE status = 'published' ORDER BY created_at DESC LIMIT ? OFFSET ?",
		limit, offset,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "查询失败"})
		return
	}
	defer rows.Close()

	var articles []models.Article
	for rows.Next() {
		var a models.Article
		if err := rows.Scan(&a.ID, &a.Title, &a.Summary, &a.Tags, &a.CoverImage, &a.Source, &a.WordCount, &a.Status, &a.Author, &a.CreatedAt, &a.UpdatedAt); err != nil {
			continue
		}
		articles = append(articles, a)
	}

	if articles == nil {
		articles = []models.Article{}
	}

	c.JSON(http.StatusOK, gin.H{
		"total": total,
		"page":  page,
		"limit": limit,
		"rows":  articles,
	})
}

// getArticle GET /api/articles/:id
// 获取单篇文章详情（公开接口）
func getArticle(c *gin.Context) {
	id := c.Param("id")

	var a models.Article
	err := db.DB.QueryRow(
		"SELECT id, title, summary, tags, cover_image, content, content_html, source, word_count, status, author, created_at, updated_at FROM articles WHERE id = ?",
		id,
	).Scan(&a.ID, &a.Title, &a.Summary, &a.Tags, &a.CoverImage, &a.Content, &a.ContentHTML, &a.Source, &a.WordCount, &a.Status, &a.Author, &a.CreatedAt, &a.UpdatedAt)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "文章不存在"})
		return
	}

	c.JSON(http.StatusOK, a)
}

// getArticleStats GET /api/articles/stats
// 获取文章统计数据
func getArticleStats(c *gin.Context) {
	var stats models.ArticleStats

	db.DB.QueryRow("SELECT COUNT(*) FROM articles").Scan(&stats.Total)
	db.DB.QueryRow("SELECT COUNT(*) FROM articles WHERE status = 'draft'").Scan(&stats.Draft)
	db.DB.QueryRow("SELECT COUNT(*) FROM articles WHERE status = 'published'").Scan(&stats.Published)
	db.DB.QueryRow("SELECT COUNT(*) FROM articles WHERE DATE(created_at) = CURDATE()").Scan(&stats.Today)

	c.JSON(http.StatusOK, stats)
}

// createArticle POST /api/articles
// 创建新文章
func createArticle(c *gin.Context) {
	var req models.CreateArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求数据"})
		return
	}

	// 获取当前用户
	username, _ := c.Get("username")
	author, _ := username.(string)

	// 默认来源
	if req.Source == "" {
		req.Source = "AI生成"
	}

	result, err := db.DB.Exec(
		"INSERT INTO articles (title, summary, tags, cover_image, content, content_html, source, word_count, status, author) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)",
		req.Title, req.Summary, req.Tags, req.CoverImage, req.Content, req.ContentHTML, req.Source, req.WordCount, author,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "创建失败: " + err.Error()})
		return
	}

	id, _ := result.LastInsertId()

	// 记录审计日志
	middleware.Audit(c, "create_article", fmt.Sprintf("%d", id), fmt.Sprintf("创建文章: %s", req.Title))

	c.JSON(http.StatusCreated, gin.H{
		"id":      id,
		"message": "文章已创建",
	})
}

// updateArticle PUT /api/articles/:id
// 更新文章
func updateArticle(c *gin.Context) {
	id := c.Param("id")

	var req models.CreateArticleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求数据"})
		return
	}

	// 检查文章是否存在
	var existingID int64
	if err := db.DB.QueryRow("SELECT id FROM articles WHERE id = ?", id).Scan(&existingID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "文章不存在"})
		return
	}

	_, err := db.DB.Exec(
		"UPDATE articles SET title = ?, summary = ?, tags = ?, cover_image = ?, content = ?, content_html = ?, source = ?, word_count = ? WHERE id = ?",
		req.Title, req.Summary, req.Tags, req.CoverImage, req.Content, req.ContentHTML, req.Source, req.WordCount, id,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "更新失败: " + err.Error()})
		return
	}

	middleware.Audit(c, "update_article", id, fmt.Sprintf("更新文章: %s", req.Title))

	c.JSON(http.StatusOK, gin.H{"message": "文章已更新"})
}

// publishArticle PUT /api/articles/:id/publish
// 发布文章（将状态改为 published）
func publishArticle(c *gin.Context) {
	id := c.Param("id")

	// 检查文章是否存在
	var existingID int64
	if err := db.DB.QueryRow("SELECT id FROM articles WHERE id = ?", id).Scan(&existingID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "文章不存在"})
		return
	}

	_, err := db.DB.Exec("UPDATE articles SET status = 'published' WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "发布失败: " + err.Error()})
		return
	}

	middleware.Audit(c, "publish_article", id, "发布文章")

	c.JSON(http.StatusOK, gin.H{"message": "文章已发布"})
}

// deleteArticle DELETE /api/articles/:id
// 删除文章
func deleteArticle(c *gin.Context) {
	id := c.Param("id")

	// 检查文章是否存在
	var title string
	if err := db.DB.QueryRow("SELECT title FROM articles WHERE id = ?", id).Scan(&title); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "文章不存在"})
		return
	}

	_, err := db.DB.Exec("DELETE FROM articles WHERE id = ?", id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "删除失败: " + err.Error()})
		return
	}

	middleware.Audit(c, "delete_article", id, fmt.Sprintf("删除文章: %s", title))

	c.JSON(http.StatusOK, gin.H{"message": "文章已删除"})
}

// splitTags 将逗号/顿号分隔的标签转为数组
func splitTags(tags string) []string {
	if tags == "" {
		return []string{}
	}
	parts := strings.FieldsFunc(tags, func(r rune) bool {
		return r == ',' || r == '，' || r == '、'
	})
	result := []string{}
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			result = append(result, p)
		}
	}
	return result
}
