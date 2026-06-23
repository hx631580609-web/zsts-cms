/**
 * 操作日志中间件
 * 在需要记录的操作路由里手动调用 audit(log), 或由中间件自动记录
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../db/cms.db');

function getDB() {
  return new Database(DB_PATH);
}

/**
 * 写入审计日志
 * @param {object} req   - express request
 * @param {string} action - 操作类型，如 'login' / 'update_page' / 'create_user'
 * @param {string} target - 操作目标，如 'visa' / 'user:3'
 * @param {string} [detail] - 补充说明
 */
function audit(req, action, target, detail) {
  const db = getDB();
  try {
    db.prepare(
      `INSERT INTO audit_log (user_id, username, action, target, detail)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      req.user?.id || null,
      req.user?.username || 'anonymous',
      action,
      target || '',
      detail || ''
    );
  } catch (e) {
    console.error('[audit] 写入失败:', e.message);
  } finally {
    db.close();
  }
}

/**
 * Express 中间件：自动记录所有写操作（POST/PUT/DELETE）
 * 放在路由之前，只记录不阻断
 */
function auditMiddleware(req, res, next) {
  const originalSend = res.send;
  // 拦截响应，只在成功时记录
  res.send = function (body) {
    if (req.method !== 'GET' && res.statusCode < 400) {
      // 异步写日志，不阻塞响应
      setImmediate(() => {
        try {
          const db = getDB();
          db.prepare(
            `INSERT INTO audit_log (user_id, username, action, target, detail)
             VALUES (?, ?, ?, ?, ?)`
          ).run(
            req.user?.id || null,
            req.user?.username || 'anonymous',
            `api_${req.method.toLowerCase()}`,
            req.route?.path || req.path,
            JSON.stringify(req.body).slice(0, 200)
          );
          db.close();
        } catch {}
      });
    }
    return originalSend.call(this, body);
  };
  next();
}

module.exports = { audit, auditMiddleware, getDB };
