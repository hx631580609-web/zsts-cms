package routes

import (
	"cms-server-go/db"
	"cms-server-go/middleware"
	"cms-server-go/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// RegisterLogRoutes 注册日志路由
func RegisterLogRoutes(r *gin.RouterGroup) {
	logs := r.Group("/logs", middleware.RequireAuth())
	{
		logs.GET("", listLogs)
		logs.DELETE("", middleware.RequireSuperAdmin(), clearLogs)
	}
}

// listLogs GET /api/logs
func listLogs(c *gin.Context) {
	var params models.LogQueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "查询参数错误"})
		return
	}

	if params.Page < 1 {
		params.Page = 1
	}
	if params.Limit < 1 {
		params.Limit = 50
	}

	offset := (params.Page - 1) * params.Limit

	// 构建 WHERE 条件
	where := "WHERE 1=1"
	var args []interface{}

	if params.Action != "" {
		where += " AND action LIKE ?"
		args = append(args, "%"+params.Action+"%")
	}
	if params.Username != "" {
		where += " AND username LIKE ?"
		args = append(args, "%"+params.Username+"%")
	}
	if params.StartDate != "" {
		where += " AND timestamp >= ?"
		args = append(args, params.StartDate)
	}
	if params.EndDate != "" {
		where += " AND timestamp <= ?"
		args = append(args, params.EndDate+" 23:59:59")
	}

	// 查询总数
	var total int64
	db.DB.QueryRow("SELECT COUNT(*) FROM audit_log "+where, args...).Scan(&total)

	// 查询数据
	query := "SELECT id, COALESCE(user_id, 0), username, action, target, detail, timestamp FROM audit_log " +
		where + " ORDER BY id DESC LIMIT ? OFFSET ?"
	queryArgs := append(args, params.Limit, offset)

	rows, err := db.DB.Query(query, queryArgs...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var logRows []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		var uid int64
		if err := rows.Scan(&l.ID, &uid, &l.Username, &l.Action, &l.Target, &l.Detail, &l.Timestamp); err != nil {
			continue
		}
		if uid > 0 {
			l.UserID = &uid
		}
		logRows = append(logRows, l)
	}

	if logRows == nil {
		logRows = []models.AuditLog{}
	}

	c.JSON(http.StatusOK, models.LogQueryResult{
		Total: total,
		Page:  params.Page,
		Limit: params.Limit,
		Rows:  logRows,
	})
}

// clearLogs DELETE /api/logs
func clearLogs(c *gin.Context) {
	db.DB.Exec("DELETE FROM audit_log")
	c.JSON(http.StatusOK, gin.H{"message": "日志已清空"})
}

// 确保 strconv 被引用
var _ = strconv.Itoa
