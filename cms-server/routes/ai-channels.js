/**
 * AI 中转站渠道配置路由
 * 超级管理员可管理渠道，普通编辑只能查看（用于文章生成时选择模型）
 *
 * GET    /api/ai-channels        —— 渠道列表
 * POST   /api/ai-channels        —— 新建渠道
 * PUT    /api/ai-channels/:id    —— 更新渠道
 * DELETE /api/ai-channels/:id    —— 删除渠道
 * PUT    /api/ai-channels/:id/set-default —— 设为默认渠道
 */

const express = require('express');
const router = express.Router();
const Database = require('better-sqlite3');
const path = require('path');
const { requireSuperAdmin } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const DB_PATH = path.join(__dirname, '../db/cms.db');

function getDB() {
  return new Database(DB_PATH);
}

// GET /api/ai-channels
router.get('/', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM ai_channels ORDER BY id').all();
  // 解析 model_list JSON
  const result = rows.map(r => ({
    ...r,
    model_list: r.model_list ? JSON.parse(r.model_list) : [],
  }));
  db.close();
  res.json(result);
});

// POST /api/ai-channels —— 新建渠道（仅超级管理员）
router.post('/', requireSuperAdmin, (req, res) => {
  const { name, api_url, api_key, model_list } = req.body;
  if (!name || !api_url) {
    return res.status(400).json({ error: 'name 和 api_url 不能为空' });
  }

  const db = getDB();
  try {
    const result = db.prepare(
      `INSERT INTO ai_channels (name, api_url, api_key, model_list, created_by)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      name,
      api_url,
      api_key || '',
      JSON.stringify(model_list || []),
      req.user.id
    );
    audit(req, 'create_ai_channel', `channel:${name}`, '');
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// PUT /api/ai-channels/:id —— 更新渠道（仅超级管理员）
router.put('/:id', requireSuperAdmin, (req, res) => {
  const { name, api_url, api_key, model_list } = req.body;
  const db = getDB();
  try {
    db.prepare(
      `UPDATE ai_channels
       SET name = ?, api_url = ?, api_key = ?, model_list = ?
       WHERE id = ?`
    ).run(
      name,
      api_url,
      api_key || '',
      JSON.stringify(model_list || []),
      req.params.id
    );
    audit(req, 'update_ai_channel', `channel:id:${req.params.id}`, '');
    res.json({ message: '渠道已更新' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// PUT /api/ai-channels/:id/set-default —— 设为默认（仅超级管理员）
router.put('/:id/set-default', requireSuperAdmin, (req, res) => {
  const db = getDB();
  // 先清除所有默认
  db.prepare('UPDATE ai_channels SET is_default = 0').run();
  // 设置新的默认
  db.prepare('UPDATE ai_channels SET is_default = 1 WHERE id = ?').run(req.params.id);
  db.close();
  audit(req, 'set_default_ai_channel', `channel:id:${req.params.id}`, '');
  res.json({ message: '默认渠道已设置' });
});

// DELETE /api/ai-channels/:id —— 删除渠道（仅超级管理员）
router.delete('/:id', requireSuperAdmin, (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM ai_channels WHERE id = ?').run(req.params.id);
  db.close();
  audit(req, 'delete_ai_channel', `channel:id:${req.params.id}`, '');
  res.json({ message: '渠道已删除' });
});

module.exports = router;
