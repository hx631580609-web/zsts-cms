package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// AppConfig 全局配置
var AppConfig *Config

// Config 应用配置结构
type Config struct {
	Port         string
	JWTSecret    string
	DBHost       string
	DBPort       string
	DBUser       string
	DBPassword   string
	DBName       string
	AIContentURL string
}

// Load 加载 .env 并初始化配置
func Load() {
	// 尝试加载 .env，不强制要求文件存在
	_ = godotenv.Load()

	AppConfig = &Config{
		Port:         getEnv("PORT", "3001"),
		JWTSecret:    getEnv("JWT_SECRET", "zsts-cms-secret-change-in-production"),
		DBHost:       getEnv("DB_HOST", "127.0.0.1"),
		DBPort:       getEnv("DB_PORT", "3306"),
		DBUser:       getEnv("DB_USER", "root"),
		DBPassword:   getEnv("DB_PASSWORD", "root"),
		DBName:       getEnv("DB_NAME", "zsts_cms"),
		AIContentURL: getEnv("AI_CONTENT_URL", "http://localhost:5000"),
	}
}

// DSN 返回 MySQL 连接字符串
func (c *Config) DSN() string {
	return c.DBUser + ":" + c.DBPassword + "@tcp(" + c.DBHost + ":" + c.DBPort + ")/" + c.DBName + "?charset=utf8mb4&parseTime=true&loc=Local"
}

// PortInt 返回整数端口号
func (c *Config) PortInt() int {
	n, _ := strconv.Atoi(c.Port)
	if n == 0 {
		n = 3001
	}
	return n
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
