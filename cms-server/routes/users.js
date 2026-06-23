/**
 * 用户管理路由（仅超级管理员可访问）
 *
 * GET    /api/users        —— 用户列表
 * POST   /api/users        —— 新建账号
 * PUT    /api/users/:id    —— 修改密码 / 重置密码
 * DELETE /api/users/:id    —— 删除账号
 * PUT    /api/users/:id/permissions  —— 修改页面权限
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');
const { requireSuperAdmin } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const DB_PATH = path.join(__dirname, '../db/cms.db');
const SALT_ROUNDS = 10;

function getDB() {
  return new Database(DB_PATH);
}

// GET /api/users —— 用户列表（含权限）
router.get('/', requireSuperAdmin, (req, res) => {
  const db = getDB();
  const users = db.prepare(
    `SELECT id, username, role, created_at, last_login FROM users ORDER BY id`
  ).all();

  const result = users.map(u => {
    const perms = db.prepare(
      'SELECT page_key FROM page_permissions WHERE user_id = ?'
    ).all(u.id);
    return { ...u, permissions: perms.map(p => p.page_key) };
  });

  db.close();
  res.json(result);
});

// POST /api/users —— 新建账号
router.post('/', requireSuperAdmin, (req, res) => {
  const { username, password, role, permissions } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (role && !['editor', 'super_admin'].includes(role)) {
    return res.status(400).json({ error: '角色值无效' });
  }

  const db = getDB();
  try {
    const hash = bcrypt.hashSync(password, SALT_ROUNDS);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    ).run(username, hash, role || 'editor');

    const newId = result.lastInsertRowid;

    // 写入页面权限
    if (Array.isArray(permissions)) {
      const insert = db.prepare(
        'INSERT OR IGNORE INTO page_permissions (user_id, page_key) VALUES (?, ?)'
      );
      const batch = db.transaction((pages) => {
        for (const p of pages) insert.run(newId, p);
      });
      batch(permissions);
    }

    audit(req, 'create_user', `user:${username}`, JSON.stringify({ role, permissions }));
    res.json({ id: newId, username, role: role || 'editor' });
  } catch (e) {
    console.error('[users.js POST] 错误：', e.message, e.stack);
    if (e.message.includes('UNIQUE')) {
      res.status(409).json({ error: '用户名已存在' });
    } else {
      res.status(500).json({ error: e.message });
    }
  } finally {
    db.close();
  }
});

// PUT /api/users/:id —— 修改密码（自己或超级管理员）
router.put('/:id', requireSuperAdmin, (req, res) => {
  const { password } = req.body;
  const targetId = parseInt(req.params.id);

  if (!password || password.length < 6) {
    return res.status(400).json({ error: '密码长度至少6位' });
  }

  const db = getDB();
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, targetId);
  db.close();

  audit(req, 'reset_password', `user:id:${targetId}`, '');
  res.json({ message: '密码已重置' });
});

// PUT /api/users/:id/permissions —— 修改页面权限
router.put('/:id/permissions', requireSuperAdmin, (req, res) => {
  const targetId = parseInt(req.params.id);
  const { permissions } = req.body;

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'permissions 必须是数组' });
  }

  const db = getDB();
  // 删除旧权限
  db.prepare('DELETE FROM page_permissions WHERE user_id = ?').run(targetId);
  // 写入新权限
  if (permissions.length > 0) {
    const insert = db.prepare(
      'INSERT OR IGNORE INTO page_permissions (user_id, page_key) VALUES (?, ?)'
    );
    const batch = db.transaction((pages) => {
      for (const p of pages) insert.run(targetId, p);
    });
    batch(permissions);
  }
  db.close();

  audit(req, 'update_permissions', `user:id:${targetId}`, JSON.stringify(permissions));
  res.json({ message: '权限已更新' });
});

// DELETE /api/users/:id —— 删除账号（不能删自己）
router.delete('/:id', requireSuperAdmin, (req, res) => {
  const targetId = parseInt(req.params.id);

  if (targetId === req.user.id) {
    return res.status(400).json({ error: '不能删除自己的账号' });
  }

  const db = getDB();
  const info = db.prepare('SELECT username FROM users WHERE id = ?').get(targetId);
  db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  // page_permissions 会自动级联删除（FOREIGN KEY ON DELETE CASCADE）
  db.close();

  audit(req, 'delete_user', `user:${info?.username || targetId}`, '');
  res.json({ message: '账号已删除' });
});

module.exports = router;
