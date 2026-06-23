package main

import (
	"cms-server-go/config"
	"cms-server-go/db"
	"cms-server-go/handlers"
	"cms-server-go/middleware"
	"cms-server-go/routes"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

func main() {
	// 加载配置
	config.Load()

	// 初始化数据库
	db.InitDB()

	// 确定项目根目录（cms-server-go 的上一级）
	exePath, _ := os.Getwd()
	projectRoot := filepath.Dir(exePath)
	// 如果是从项目根目录运行 go run，需要检测
	if filepath.Base(exePath) == "cms-server-go" {
		projectRoot = exePath + "/.."
	}
	projectRoot, _ = filepath.Abs(projectRoot)

	// 初始化目录
	handlers.InitUploadDir(projectRoot)
	handlers.InitPreview(projectRoot)
	routes.InitContentDirs(projectRoot)

	// 创建 Gin 引擎
	r := gin.Default()

	// 全局中间件
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())

	// 限制请求体大小 (10MB)
	r.MaxMultipartMemory = 10 << 20

	// ── 文件上传 ─────────────────────────────────────
	r.POST("/api/upload", middleware.RequireAuth(), handlers.UploadHandler)

	// ── 静态文件 ─────────────────────────────────────
	r.Static("/admin", filepath.Join(projectRoot, "admin"))
	r.Static("/uploads", filepath.Join(projectRoot, "uploads"))
	r.Static("/local-cdn", filepath.Join(projectRoot, "local-cdn"))
	r.Static("/images", filepath.Join(projectRoot, "images"))
	// 注意：/preview/images 和 /preview/local-cdn 不注册静态路由，
	// 因为 Gin 不允许同前缀下混用通配符路由（/preview/*filepath）和具体路径路由。
	// 这些请求由 PreviewHandler 内部处理（转发到 /images 和 /local-cdn）。

	// favicon
	r.GET("/favicon.ico", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	// ── 预览客户端 JS ────────────────────────────────
	r.GET("/preview-client-v2.js", handlers.PreviewClientJS("v2"))
	r.GET("/preview-client-v4.js", handlers.PreviewClientJS("v4"))

	// ── 预览模式 ─────────────────────────────────────
	r.GET("/preview/*filepath", handlers.PreviewHandler)

	// ── API 路由 ─────────────────────────────────────
	api := r.Group("/api")
	{
		routes.RegisterAuthRoutes(api)
		routes.RegisterUserRoutes(api)
		routes.RegisterContentRoutes(api)
		routes.RegisterLogRoutes(api)
		routes.RegisterAIChannelRoutes(api)
	}

	// ── 页面快照 ─────────────────────────────────────
	r.GET("/api/page-snapshot/:pageKey", handlers.PageSnapshotHandler)

	// ── AI 内容生成代理 ─────────────────────────────
	setupAIProxy(r)

	// ── 管理后台 SPA 路由兜底 ──────────────────────
	r.NoRoute(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/admin") {
			c.File(filepath.Join(projectRoot, "admin", "index.html"))
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
	})

	// ── 根路径重定向 ────────────────────────────────
	r.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/admin/")
	})

	// 启动
	port := config.AppConfig.PortInt()
	fmt.Printf("\n✅ ZSTS CMS 后端已启动 (Go/Gin)\n")
	fmt.Printf("   管理后台：http://localhost:%d/admin/\n", port)
	fmt.Printf("   API Base：http://localhost:%d/api/\n\n", port)

	if err := r.Run(fmt.Sprintf(":%d", port)); err != nil {
		log.Fatalf("启动失败: %v", err)
	}
}

// corsMiddleware CORS 中间件
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// setupAIProxy 设置 AI 内容生成反向代理
func setupAIProxy(r *gin.Engine) {
	target, err := url.Parse(config.AppConfig.AIContentURL)
	if err != nil {
		log.Printf("⚠️  AI_CONTENT_URL 配置错误: %v", err)
		return
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// 自定义错误处理：目标不可达时返回友好提示而非 502
	proxy.ErrorHandler = func(w http.ResponseWriter, req *http.Request, err error) {
		log.Printf("AI 内容生成服务代理失败: %v", err)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte(`{"error":"AI 内容生成服务未启动，请先启动 ai-content-project 服务（` + target.String() + `）"}`))
	}

	// 修改请求，注入用户信息
	defaultDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		defaultDirector(req)
		req.Host = req.URL.Host
	}

	r.Use(func(c *gin.Context) {
		if !strings.HasPrefix(c.Request.URL.Path, "/ai-content") {
			return
		}

		// 验证认证
		claims, err := middleware.VerifyToken(c)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			c.Abort()
			return
		}

		// 注入用户信息到请求头
		c.Request.Header.Set("X-CMS-User", claims.Username)
		c.Request.Header.Set("X-CMS-Role", claims.Role)

		// 添加 cookie
		cookie := fmt.Sprintf("cms_user=%s; Path=/", claims.Username)
		if existing := c.Request.Header.Get("Cookie"); existing != "" {
			c.Request.Header.Set("Cookie", existing+"; "+cookie)
		} else {
			c.Request.Header.Set("Cookie", cookie)
		}

		proxy.ServeHTTP(c.Writer, c.Request)
		c.Abort()
	})
}
