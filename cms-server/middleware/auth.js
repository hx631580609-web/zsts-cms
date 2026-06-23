/**
 * 认证中间件
 * - requireAuth：验证 JWT，注入 req.user
 * - requireSuperAdmin：requireAuth + 验证 role === 'super_admin'
 * - requirePagePerm(pageKey)：验证是否有某页面权限
 */

const jwt = require('jsonwebtoken');
const path = require('path');
const Database = require('better-sqlite3');

const JWT_SECRET = process.env.JWT_SECRET || 'zsts-cms-secret-change-in-production';
const DB_PATH = path.join(__dirname, '../db/cms.db');
const TOKEN_EXPIRY = '7d';

function getDB() {
  return new Database(DB_PATH);
}

// 验证 JWT，注入 req.user
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: '未提供认证令牌' });

  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: '令牌格式错误' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;  // { id, username, role }
    next();
  } catch {
    res.status(401).json({ error: '令牌已失效，请重新登录' });
  }
}

// 验证超级管理员
function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '未认证' });
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: '需要超级管理员权限' });
  }
  next();
}

// 验证页面权限（用于页面内容编辑接口）
function requirePagePerm(pageKey) {
  return (req, res, next) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: '未认证' });
    // 超级管理员有所有权限
    if (user.role === 'super_admin') return next();

    const db = getDB();
    const row = db.prepare(
      'SELECT 1 FROM page_permissions WHERE user_id = ? AND page_key = ?'
    ).get(user.id, pageKey);
    db.close();

    if (!row) return res.status(403).json({ error: `无 [${pageKey}] 页面编辑权限` });
    next();
  };
}

// 检查当前用户是否有某页面权限（用于前端菜单渲染，不阻断请求）
function checkPageAccess(userId, pageKey, db) {
  if (!db) {
    const db2 = getDB();
    const r = db2.prepare(
      'SELECT 1 FROM users WHERE id = ? AND role = ?', 'super_admin'
    );
    // ...
    db2.close();
  }
  // 简化：在 routes 里直接查
}

module.exports = {
  requireAuth,
  requireSuperAdmin,
  requirePagePerm,
  JWT_SECRET,
  TOKEN_EXPIRY,
  getDB,
};
