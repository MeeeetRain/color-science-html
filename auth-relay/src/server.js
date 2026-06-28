// 邮箱验证码登录中继 — 跑在能运行 agently-cli 的常开主机上(非 Worker)。
// 发码走 agently-cli message +send(两段式确认),存储用进程内存,JWT 用 HS256。
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const pexecFile = promisify(execFile);

// ---- 环境配置 ----
const PORT = parseInt(process.env.PORT || '8787', 10);
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || 'skyworth.com';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const JWT_SECRET = process.env.JWT_SECRET || '';
const TOKEN_TTL_DAYS = parseInt(process.env.TOKEN_TTL_DAYS || '3650', 10); // 默认 10 年≈一次登录长期保留
const AGENTLY_BIN = process.env.AGENTLY_BIN || 'agently-cli';
const DEV = process.env.ENVIRONMENT === 'dev';

// ---- 可调常量 ----
const CODE_TTL = 5 * 60 * 1000;       // 验证码有效期 5 分钟
const RESEND_COOLDOWN = 60 * 1000;    // 同邮箱重发冷却 60s
const MAX_PER_HOUR = 5;               // 同邮箱每小时发码上限
const MAX_IP_PER_HOUR = 20;           // 同 IP 每小时发码上限
const MAX_ATTEMPTS = 5;               // 单验证码最多尝试次数

if (!JWT_SECRET) {
  console.error('FATAL: 未设置 JWT_SECRET 环境变量'); process.exit(1);
}

// ===================== 内存存储 =====================
const codes = new Map();      // email -> { code, attempts, expiresAt }
const cooldowns = new Map();  // email -> expiresAt
const hourly = new Map();     // key   -> { count, resetAt }

function hourlyHit(key, max) {
  const now = Date.now();
  let rec = hourly.get(key);
  if (!rec || now > rec.resetAt) { rec = { count: 0, resetAt: now + 3600_000 }; hourly.set(key, rec); }
  if (rec.count >= max) return false;
  rec.count += 1;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of codes) if (now > v.expiresAt) codes.delete(k);
  for (const [k, v] of cooldowns) if (now > v) cooldowns.delete(k);
  for (const [k, v] of hourly) if (now > v.resetAt) hourly.delete(k);
}, 60_000).unref();

// ===================== JWT (HS256 / Web Crypto) =====================
function b64urlFromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromString(s) { return b64urlFromBytes(new TextEncoder().encode(s)); }
function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signJWT(payload) {
  const head = b64urlFromString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64urlFromString(JSON.stringify(payload));
  const data = `${head}.${body}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(JWT_SECRET), new TextEncoder().encode(data));
  return `${data}.${b64urlFromBytes(new Uint8Array(sig))}`;
}
async function verifyJWT(token) {
  try {
    const parts = (token || '').split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(JWT_SECRET),
      b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// ===================== 工具 =====================
function genCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normEmail = (v) => String(v || '').trim().toLowerCase();

function codeEmailHtml(code) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,PingFang SC,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 8px">影像色彩与显示技术指南</h2>
    <p style="color:#555;margin:0 0 20px">Color &amp; Display Technology Guide</p>
    <p>你的登录验证码 / Your login code:</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:8px;margin:14px 0;color:#0a7">${code}</div>
    <p style="color:#777;font-size:13px">5 分钟内有效,请勿泄露。<br>Valid for 5 minutes. Do not share this code.</p>
  </div>`;
}

// agently-cli 两段式发送:第一次拿 confirmation_token,第二次带 token 真正发出
async function sendViaAgently(to, code) {
  const subject = `登录验证码 ${code} / Login code ${code}`;
  const body = codeEmailHtml(code);
  const base = ['message', '+send', '--to', to, '--subject', subject, '--body', body, '--body-format', 'html'];
  const opts = { maxBuffer: 4 * 1024 * 1024 };

  const { stdout: out1 } = await pexecFile(AGENTLY_BIN, base, opts);
  const tok = JSON.parse(out1)?.data?.confirmation_token;
  if (!tok) throw new Error('未拿到 confirmation_token: ' + out1.slice(0, 200));

  const { stdout: out2 } = await pexecFile(AGENTLY_BIN, [...base, '--confirmation-token', tok], opts);
  const r2 = JSON.parse(out2);
  if (!r2.ok) throw new Error('发送失败: ' + out2.slice(0, 200));
}

// ===================== Hono =====================
const app = new Hono();
app.use('*', cors({
  origin: (o) => {
    if (ALLOWED_ORIGINS.includes('*')) return o || '*';
    return ALLOWED_ORIGINS.includes(o) ? o : '';
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

app.get('/', (c) => c.json({ ok: true, service: 'color-science-auth-relay', dev: DEV }));

function clientIp(c) {
  return c.req.header('CF-Connecting-IP') ||
    (c.req.header('X-Forwarded-For') || '').split(',')[0].trim() || 'unknown';
}

// ① 发码
app.post('/api/send-code', async (c) => {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }
  const email = normEmail(body.email);
  if (!EMAIL_RE.test(email)) return c.json({ error: '邮箱格式不正确' }, 400);
  if (email.split('@')[1] !== ALLOWED_DOMAIN) return c.json({ error: `仅限 @${ALLOWED_DOMAIN} 邮箱登录` }, 403);

  const now = Date.now();
  const cd = cooldowns.get(email);
  if (cd && now < cd) return c.json({ error: '请求过于频繁,请稍后再试' }, 429);
  if (!hourlyHit(`e:${email}`, MAX_PER_HOUR)) return c.json({ error: '发送次数过多,请 1 小时后再试' }, 429);
  if (!hourlyHit(`ip:${clientIp(c)}`, MAX_IP_PER_HOUR)) return c.json({ error: '请求过于频繁,请稍后再试' }, 429);

  const code = genCode();
  codes.set(email, { code, attempts: 0, expiresAt: now + CODE_TTL });

  if (DEV) {
    console.log(`[dev] code for ${email}: ${code}`);
  } else {
    try {
      await sendViaAgently(email, code);
    } catch (e) {
      console.error('agently send failed:', e.message);
      return c.json({ error: '邮件发送失败,请稍后再试' }, 502);
    }
  }
  cooldowns.set(email, now + RESEND_COOLDOWN);
  const resp = { success: true, cooldown: RESEND_COOLDOWN / 1000 };
  if (DEV) resp.devCode = code;
  return c.json(resp);
});

// ② 校验 → 签发 JWT
app.post('/api/verify-code', async (c) => {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }
  const email = normEmail(body.email);
  const code = String(body.code || '').trim();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) return c.json({ error: '邮箱或验证码格式不正确' }, 400);

  const rec = codes.get(email);
  if (!rec || Date.now() > rec.expiresAt) { codes.delete(email); return c.json({ error: '验证码已过期或不存在,请重新获取' }, 400); }
  if (rec.attempts >= MAX_ATTEMPTS) { codes.delete(email); return c.json({ error: '尝试次数过多,请重新获取验证码' }, 429); }
  if (rec.code !== code) {
    rec.attempts += 1;
    return c.json({ error: '验证码不正确', remainingAttempts: MAX_ATTEMPTS - rec.attempts }, 400);
  }
  codes.delete(email);
  const nowSec = Math.floor(Date.now() / 1000);
  const token = await signJWT({ sub: email, iat: nowSec, exp: nowSec + TOKEN_TTL_DAYS * 86400 });
  return c.json({ token, email });
});

// ③ 校验 token
app.get('/api/verify-token', async (c) => {
  const auth = c.req.header('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const payload = await verifyJWT(token);
  if (!payload) return c.json({ valid: false }, 401);
  return c.json({ valid: true, email: payload.sub, exp: payload.exp });
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`auth-relay listening on http://127.0.0.1:${info.port}  (dev=${DEV}, domain=@${ALLOWED_DOMAIN})`);
  console.log(`allowed origins: ${ALLOWED_ORIGINS.join(', ') || '(none set!)'}`);
});
