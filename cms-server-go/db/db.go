package db

import (
	"cms-server-go/config"
	"database/sql"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

var DB *sql.DB

// InitDB 初始化 MySQL 连接并创建表
func InitDB() {
	var err error
	dsn := config.AppConfig.DSN()
	DB, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("[DB] 无法打开数据库连接: %v", err)
	}

	// 先创建数据库（如果不存在）
	createDBIfNotExists()

	// 连接池配置
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(10)

	if err = DB.Ping(); err != nil {
		log.Fatalf("[DB] 数据库连接失败: %v", err)
	}
	log.Println("[DB] MySQL 连接成功")

	// 创建表
	createTables()

	// 插入默认管理员
	seedAdmin()

	log.Println("[DB] 初始化完成")
}

// createDBIfNotExists 如果数据库不存在则创建
func createDBIfNotExists() {
	cfg := config.AppConfig
	dsn := cfg.DBUser + ":" + cfg.DBPassword + "@tcp(" + cfg.DBHost + ":" + cfg.DBPort + ")/"
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("[DB] 无法连接 MySQL 服务器: %v", err)
	}
	defer db.Close()

	_, err = db.Exec("CREATE DATABASE IF NOT EXISTS `" + cfg.DBName + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
	if err != nil {
		log.Fatalf("[DB] 创建数据库失败: %v", err)
	}
}

// createTables 创建所有数据表
func createTables() {
	// users 表
	DB.Exec(`CREATE TABLE IF NOT EXISTS users (
		id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		username     VARCHAR(100) UNIQUE NOT NULL,
		password_hash VARCHAR(255) NOT NULL,
		role         ENUM('super_admin', 'editor') NOT NULL DEFAULT 'editor',
		created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		last_login   DATETIME DEFAULT NULL
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

	// page_permissions 表
	DB.Exec(`CREATE TABLE IF NOT EXISTS page_permissions (
		user_id   BIGINT UNSIGNED NOT NULL,
		page_key  VARCHAR(100) NOT NULL,
		PRIMARY KEY (user_id, page_key),
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

	// audit_log 表
	DB.Exec(`CREATE TABLE IF NOT EXISTS audit_log (
		id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		user_id   BIGINT UNSIGNED DEFAULT NULL,
		username  VARCHAR(100) NOT NULL DEFAULT 'system',
		action    VARCHAR(100) NOT NULL,
		target    VARCHAR(255) DEFAULT '',
		detail    TEXT,
		timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)

	// ai_channels 表
	DB.Exec(`CREATE TABLE IF NOT EXISTS ai_channels (
		id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
		name        VARCHAR(255) NOT NULL,
		api_url     VARCHAR(500) NOT NULL,
		api_key     TEXT,
		model_list  JSON,
		is_default  TINYINT NOT NULL DEFAULT 0,
		created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		created_by  BIGINT UNSIGNED DEFAULT NULL,
		FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
}

// seedAdmin 插入默认超级管理员
func seedAdmin() {
	var count int
	err := DB.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", "admin").Scan(&count)
	if err != nil {
		log.Printf("[DB] 查询管理员失败: %v", err)
		return
	}
	if count > 0 {
		log.Println("[DB] 数据库已存在，跳过初始化。")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), 10)
	if err != nil {
		log.Printf("[DB] 密码哈希失败: %v", err)
		return
	}

	result, err := DB.Exec(
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		"admin", string(hash), "super_admin",
	)
	if err != nil {
		log.Printf("[DB] 创建管理员失败: %v", err)
		return
	}

	adminID, _ := result.LastInsertId()

	// 分配所有页面权限
	allPages := []string{
		"global", "home", "about", "visa", "saudi-visa", "saudi-news",
		"enterprise", "transport", "insurance", "inspection",
	}
	for _, p := range allPages {
		DB.Exec("INSERT IGNORE INTO page_permissions (user_id, page_key) VALUES (?, ?)", adminID, p)
	}

	// 写入操作日志
	DB.Exec(
		"INSERT INTO audit_log (user_id, username, action, target, detail) VALUES (?, ?, 'system_init', 'users', ?)",
		adminID, "admin", "初始化超级管理员账号: admin / admin123",
	)

	fmt.Println("[DB] 已创建默认超级管理员：admin / admin123")
	fmt.Println("[DB] ⚠️  请首次登录后立即修改密码！")
}
