/**
 * CMS API 集成测试
 * 用法：node test-api.js
 */

const http = require('http');
const path = require('path');

const BASE = 'http://127.0.0.1:3001';
let adminToken = '';
let editorToken = '';

function req(method, url, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const h = { ...headers };
    if (body) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(body); }
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path: url.replace(BASE, ''),
      method,
      headers: h,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, body: data }); } });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function test() {
  let pass = 0, fail = 0;
  function assert(desc, condition, detail = '') {
    if (condition) { console.log(`  ✅ ${desc}`); pass++; }
    else { console.log(`  ❌ ${desc}  ${detail}`); fail++; }
  }

  function logRes(step, res) {
    console.log(`  [${step}] status=${res.status} body=${JSON.stringify(res.body).slice(0,120)}`);
  }

  console.log('\n=== 1. 管理员登录 ===');
  let res = await req('POST', `${BASE}/api/auth/login`, {}, JSON.stringify({ username:'admin', password:'admin123' }));
  assert('登录成功', res.status === 200 && res.body.token);
  adminToken = res.body.token;

  console.log('\n=== 2. /api/auth/me ===');
  res = await req('GET', `${BASE}/api/auth/me`, { 'Authorization': `Bearer ${adminToken}` });
  assert('获取用户信息', res.status === 200 && res.body.username === 'admin');

  console.log('\n=== 3. /api/users（超级管理员）===');
  res = await req('GET', `${BASE}/api/users`, { 'Authorization': `Bearer ${adminToken}` });
  assert('获取用户列表', res.status === 200 && Array.isArray(res.body) && res.body.length >= 1);

  console.log('\n=== 4. 创建编辑账号 ===');
  res = await req('POST', `${BASE}/api/users`, { 'Authorization': `Bearer ${adminToken}` }, JSON.stringify({
    username: 'editor1', password: '123456', role: 'editor', permissions: ['home', 'about']
  }));
  assert('创建成功', res.status === 200 || res.status === 201);
  const editorId = res.body.id;

  console.log('\n=== 5. editor1 登录 ===');
  res = await req('POST', `${BASE}/api/auth/login`, {}, JSON.stringify({ username:'editor1', password:'123456' }));
  assert('editor1 登录成功', res.status === 200 && res.body.token);
  editorToken = res.body.token;

  console.log('\n=== 6. 权限校验 ===');
  res = await req('GET', `${BASE}/api/content/home`, { 'Authorization': `Bearer ${editorToken}` });
  assert('editor1 读 home（有权限）=== 200', res.status === 200);
  res = await req('GET', `${BASE}/api/content/visa`, { 'Authorization': `Bearer ${editorToken}` });
  assert('editor1 读 visa（无权限）=== 403', res.status === 403);
  res = await req('GET', `${BASE}/api/content/nav`, { 'Authorization': `Bearer ${editorToken}` });
  assert('editor1 读 nav（全局配置）=== 403', res.status === 403);

  console.log('\n=== 7. 写权限校验 ===');
  res = await req('PUT', `${BASE}/api/content/home`, { 'Authorization': `Bearer ${editorToken}` }, JSON.stringify({ hero:{ title:{ zh:'测试', en:'Test' } } }));
  assert('editor1 写 home（有权限）=== 200', res.status === 200);
  res = await req('PUT', `${BASE}/api/content/visa`, { 'Authorization': `Bearer ${editorToken}` }, JSON.stringify({ test:1 }));
  assert('editor1 写 visa（无权限）=== 403', res.status === 403);

  console.log('\n=== 8. 超级管理员写全局配置 ===');
  res = await req('PUT', `${BASE}/api/content/nav`, { 'Authorization': `Bearer ${adminToken}` }, JSON.stringify({ brand:'ZSTS' }));
  assert('admin 写 nav === 200', res.status === 200);
  res = await req('GET', `${BASE}/api/content/nav`, { 'Authorization': `Bearer ${adminToken}` });
  assert('admin 读 nav === 200', res.status === 200 && res.body.brand === 'ZSTS');

  console.log('\n=== 9. 操作日志 ===');
  res = await req('GET', `${BASE}/api/logs`, { 'Authorization': `Bearer ${adminToken}` });
  assert('读取日志', res.status === 200 && res.body.total >= 1);

  console.log('\n=== 10. 清理测试账号 ===');
  res = await req('DELETE', `${BASE}/api/users/${editorId}`, { 'Authorization': `Bearer ${adminToken}` });
  assert('删除 editor1', res.status === 200);

  console.log(`\n\n📊 测试结果：${pass} 通过，${fail} 失败\n`);
  process.exit(fail > 0 ? 1 : 0);
}

test().catch(console.error);
