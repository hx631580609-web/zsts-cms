/**
 * POST /api/auth/login  登录
 * POST /api/auth/logout 登出（前端清 token 即可，后端无需操作）
 * GET  /api/auth/me     获取当前用户信息
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');
const { JWT_SECRET } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const DB_PATH = path.join(__dirname, '../db/cms.db');

function getDB() {
  return new Database(DB_PATH);
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const db = getDB();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    db.close();
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  // 更新最后登录时间
  db.prepare("UPDATE users SET last_login = datetime('now', 'localtime') WHERE id = ?").run(user.id);

  // 获取该用户的页面权限
  const perms = db.prepare('SELECT page_key FROM page_permissions WHERE user_id = ?').all(user.id);
  db.close();

  // 生成 JWT
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  audit(req, 'login', `user:${username}`, `IP: ${req.ip}`);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions: perms.map(p => p.page_key),
    }
  });
});

// GET /api/auth/me —— 前端启动时用 token 恢复会话
router.get('/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: '未认证' });

  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: '令牌格式错误' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = getDB();
    const user = db.prepare('SELECT id, username, role, created_at, last_login FROM users WHERE id = ?').get(payload.id);
    if (!user) { db.close(); return res.status(401).json({ error: '用户不存在' }); }

    const perms = db.prepare('SELECT page_key FROM page_permissions WHERE user_id = ?').all(user.id);
    db.close();

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      created_at: user.created_at,
      last_login: user.last_login,
      permissions: perms.map(p => p.page_key),
    });
  } catch {
    res.status(401).json({ error: '令牌已失效' });
  }
});

module.exports = router;
