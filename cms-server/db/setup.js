/**
 * SQLite 数据库初始化
 * 创建 users / page_permissions / audit_log 表
 * 插入默认超级管理员账号
 */

const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, 'cms.db');
const SALT_ROUNDS = 10;

function initDB() {
  const db = new Database(DB_PATH);
  console.log('[DB] 初始化数据库:', DB_PATH);

  // ── users 表 ──────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      username     TEXT    UNIQUE NOT NULL,
      password_hash TEXT    NOT NULL,
      role         TEXT    NOT NULL DEFAULT 'editor'
                             CHECK(role IN ('super_admin', 'editor')),
      created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      last_login   TEXT
    );
  `);

  // ── page_permissions 表 ───────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_permissions (
      user_id   INTEGER NOT NULL,
      page_key  TEXT    NOT NULL,
      PRIMARY KEY (user_id, page_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // ── audit_log 表 ──────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER,
      username  TEXT    NOT NULL DEFAULT 'system',
      action    TEXT    NOT NULL,
      target    TEXT,
      detail    TEXT,
      timestamp TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // ── ai_channels 表（AI中转站配置）────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_channels (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      api_url     TEXT    NOT NULL,
      api_key     TEXT,
      model_list  TEXT,           -- JSON 数组，如 ["gpt-4o", "claude-3.5"]
      is_default  INTEGER NOT NULL DEFAULT 0,  -- 0/1
      created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      created_by  INTEGER,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // ── 沙特资讯：由 AI 内容生成后台提供，CMS 不再创建 news_articles 表 ─────────────

  // ── 插入默认超级管理员 ─────────────────────────────────
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', SALT_ROUNDS);
    const result = db.prepare(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    ).run('admin', hash, 'super_admin');
    const adminId = result.lastInsertRowid;

    // 给超级管理员分配所有页面权限
    const allPages = [
      'global', 'home', 'about', 'visa', 'saudi-visa', 'saudi-news',
      'enterprise', 'transport', 'insurance', 'inspection'
    ];
    const insertPerm = db.prepare(
      'INSERT OR IGNORE INTO page_permissions (user_id, page_key) VALUES (?, ?)'
    );
    const batch = db.transaction((pages) => {
      for (const p of pages) insertPerm.run(adminId, p);
    });
    batch(allPages);

    // 写入操作日志
    db.prepare(
      `INSERT INTO audit_log (user_id, username, action, target, detail)
       VALUES (?, ?, 'system_init', 'users', ?)`
    ).run(adminId, 'admin', `初始化超级管理员账号: admin / admin123`);

    console.log('[DB] 已创建默认超级管理员：admin / admin123');
    console.log('[DB] ⚠️  请首次登录后立即修改密码！');
  } else {
    console.log('[DB] 数据库已存在，跳过初始化。');
  }

  db.close();
  console.log('[DB] 初始化完成。');
}

module.exports = { initDB, DB_PATH };

if (require.main === module) {
  initDB();
}
