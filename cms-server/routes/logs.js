/**
 * 操作日志路由
 *
 * GET /api/logs        —— 查询日志（分页 + 过滤）
 * DELETE /api/logs     —— 清空日志（仅超级管理员）
 */

const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const { requireSuperAdmin } = require('../middleware/auth');

const DB_PATH = path.join(__dirname, '../db/cms.db');

function getDB() {
  return new Database(DB_PATH);
}

// GET /api/logs?page=1&limit=50&action=&username=&start_date=&end_date=
router.get('/', (req, res) => {
  const {
    page = 1,
    limit = 50,
    action = '',
    username = '',
    start_date = '',
    end_date = '',
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE 1=1';
  const params = [];

  if (action) { where += ' AND action LIKE ?'; params.push(`%${action}%`); }
  if (username) { where += ' AND username LIKE ?'; params.push(`%${username}%`); }
  if (start_date) { where += ' AND timestamp >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND timestamp <= ?'; params.push(end_date + ' 23:59:59'); }

  const db = getDB();
  const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_log ${where}`).get(...params).c;
  const rows = db.prepare(
    `SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
  ).all(...params, parseInt(limit), offset);

  db.close();
  res.json({ total, page: parseInt(page), limit: parseInt(limit), rows });
});

// DELETE /api/logs —— 清空日志（仅超级管理员）
router.delete('/', requireSuperAdmin, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM audit_log').run();
  db.close();
  res.json({ message: '日志已清空' });
});

module.exports = router;
