/**
 * 页面内容读写路由
 *
 * GET  /api/content/:pageKey   —— 读取某页面 JSON（需登录）
 * PUT  /api/content/:pageKey   —— 更新某页面 JSON（需对应权限）
 *
 * pageKey 合法值：
 *   全局类：nav / footer / consultation（仅超级管理员可写）
 *   页面类：home / about / visa / saudi-visa / enterprise / transport / insurance / inspection
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();

const CONTENT_DIR = path.join(__dirname, '../../content/pages');
const GLOBAL_DIR  = path.join(__dirname, '../../content/global');
const DB_PATH     = path.join(__dirname, '../db/cms.db');

if (!fs.existsSync(CONTENT_DIR)) fs.mkdirSync(CONTENT_DIR, { recursive: true });
if (!fs.existsSync(GLOBAL_DIR))  fs.mkdirSync(GLOBAL_DIR,  { recursive: true });

const VALID_PAGE_KEYS = [
  'home', 'about', 'visa', 'saudi-visa',
  'enterprise', 'transport', 'insurance', 'inspection'
];

function getDB() {
  return new Database(DB_PATH);
}

// ── 权限检查辅助 ──────────────────────────────────────
function checkPagePerm(userId, pageKey) {
  if (pageKey === 'global' || ['nav','footer','consultation'].includes(pageKey)) return true; // 由调用方检查 super_admin
  const db = getDB();
  const row = db.prepare(
    'SELECT 1 FROM page_permissions WHERE user_id = ? AND page_key = ?'
  ).get(userId, pageKey);
  db.close();
  return !!row;
}

// ── GET /api/content/:pageKey ────────────────────────
// 无需认证（预览模式需要访问）
router.get('/:pageKey', (req, res) => {
  const { pageKey } = req.params;

  // 全局配置
  if (['nav','footer','consultation'].includes(pageKey)) {
    const filePath = path.join(GLOBAL_DIR, `${pageKey}.json`);
    return res.json(fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {});
  }

  if (!VALID_PAGE_KEYS.includes(pageKey)) {
    return res.status(400).json({ error: `无效的页面 key: ${pageKey}` });
  }

  const filePath = path.join(CONTENT_DIR, `${pageKey}.json`);
  res.json(fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {});
});

// ── PUT /api/content/:pageKey ────────────────────────
router.put('/:pageKey', requireAuth, (req, res) => {
  const { pageKey } = req.params;
  const user = req.user;
  const body = req.body;

  // 全局配置：仅超级管理员
  if (['nav','footer','consultation'].includes(pageKey)) {
    if (user.role !== 'super_admin') {
      return res.status(403).json({ error: '需要超级管理员权限' });
    }
    const filePath = path.join(GLOBAL_DIR, `${pageKey}.json`);
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf8');
    audit(req, 'update_global', pageKey, '');
    return res.json({ message: '全局配置已保存' });
  }

  if (!VALID_PAGE_KEYS.includes(pageKey)) {
    return res.status(400).json({ error: `无效的页面 key: ${pageKey}` });
  }

  // 普通编辑：检查页面权限
  if (user.role !== 'super_admin' && !checkPagePerm(user.id, pageKey)) {
    return res.status(403).json({ error: `无 [${pageKey}] 页面编辑权限` });
  }

  const filePath = path.join(CONTENT_DIR, `${pageKey}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf8');
    audit(req, 'update_page', pageKey, '');
    res.json({ message: '页面内容已保存' });
  } catch (e) {
    res.status(500).json({ error: '写入失败：' + e.message });
  }
});

module.exports = router;
