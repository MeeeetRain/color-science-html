// 邮箱验证码登录后端 — Cloudflare Worker (Hono)
// 流程: send-code → KV 存码(5min) → Resend 发信 → verify-code → 签发 HS256 JWT
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// ---- 可调常量 ----
const CODE_TTL = 300;          // 验证码有效期(秒)= 5 分钟
const RESEND_COOLDOWN = 60;    // 同一邮箱两次发码最小间隔(秒)
const MAX_PER_HOUR = 5;        // 同一邮箱每小时最多发码次数
const MAX_IP_PER_HOUR = 20;    // 同一 IP 每小时最多发码次数
const MAX_ATTEMPTS = 5;        // 单个验证码最多尝试次数

// ===================== JWT (HS256 / Web Crypto) =====================
function b64urlFromBytes(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromString(s) {
  return b64urlFromBytes(new TextEncoder().encode(s));
}
function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}
async function signJWT(payload, secret) {
  const header = b64urlFromString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64urlFromString(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${b64urlFromBytes(new Uint8Array(sig))}`;
}
async function verifyJWT(token, secret) {
  try {
    const parts = (token || '').split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify(
      'HMAC', key, b64urlToBytes(s), new TextEncoder().encode(`${h}.${p}`)
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ===================== 工具 =====================
function genCode() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normEmail(v) { return String(v || '').trim().toLowerCase(); }

async function sendEmail(env, to, code) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [to],
      subject: `登录验证码 ${code} / Login code ${code}`,
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,PingFang SC,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
          <h2 style="margin:0 0 8px">影像色彩与显示技术指南</h2>
          <p style="color:#555;margin:0 0 20px">Color &amp; Display Technology Guide</p>
          <p>你的登录验证码 / Your login code:</p>
          <div style="font-size:34px;font-weight:700;letter-spacing:8px;margin:14px 0;color:#0a7">${code}</div>
          <p style="color:#777;font-size:13px">5 分钟内有效,请勿泄露。<br>Valid for 5 minutes. Do not share this code.</p>
        </div>`,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend ${res.status}: ${t}`);
  }
}

// ===================== CORS(按 env.ALLOWED_ORIGINS 放行) =====================
app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const mw = cors({
    origin: (o) => {
      if (allowed.includes('*')) return o || '*';
      return allowed.includes(o) ? o : '';
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });
  return mw(c, next);
});

app.get('/', (c) => c.json({ ok: true, service: 'color-science-auth' }));

// ===================== ① 发送验证码 =====================
app.post('/api/send-code', async (c) => {
  const env = c.env;
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }

  const email = normEmail(body.email);
  if (!EMAIL_RE.test(email)) return c.json({ error: '邮箱格式不正确' }, 400);
  const domain = email.split('@')[1];
  if (domain !== env.ALLOWED_DOMAIN) {
    return c.json({ error: `仅限 @${env.ALLOWED_DOMAIN} 邮箱登录` }, 403);
  }

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';

  // 限流: 邮箱冷却
  if (await env.AUTH_KV.get(`cd:${email}`)) {
    return c.json({ error: '请求过于频繁,请稍后再试' }, 429);
  }
  // 限流: 邮箱每小时
  const hKey = `rlh:${email}`;
  const hCount = parseInt((await env.AUTH_KV.get(hKey)) || '0', 10);
  if (hCount >= MAX_PER_HOUR) return c.json({ error: '发送次数过多,请 1 小时后再试' }, 429);
  // 限流: IP 每小时
  const ipKey = `rlh:ip:${ip}`;
  const ipCount = parseInt((await env.AUTH_KV.get(ipKey)) || '0', 10);
  if (ipCount >= MAX_IP_PER_HOUR) return c.json({ error: '请求过于频繁,请稍后再试' }, 429);

  const code = genCode();
  const rec = { code, attempts: 0, expiresAt: Date.now() + CODE_TTL * 1000 };
  await env.AUTH_KV.put(`code:${email}`, JSON.stringify(rec), { expirationTtl: CODE_TTL });

  const isDev = env.ENVIRONMENT === 'dev';
  if (isDev) {
    console.log(`[dev] code for ${email}: ${code}`);
  } else {
    try {
      await sendEmail(env, email, code);
    } catch (e) {
      console.error('send mail failed:', e.message);
      return c.json({ error: '邮件发送失败,请稍后再试' }, 502);
    }
  }

  // 计数 / 冷却
  await env.AUTH_KV.put(`cd:${email}`, '1', { expirationTtl: RESEND_COOLDOWN });
  await env.AUTH_KV.put(hKey, String(hCount + 1), { expirationTtl: 3600 });
  await env.AUTH_KV.put(ipKey, String(ipCount + 1), { expirationTtl: 3600 });

  const resp = { success: true, cooldown: RESEND_COOLDOWN };
  if (isDev) resp.devCode = code; // 仅 dev 模式回传,便于联调
  return c.json(resp);
});

// ===================== ② 校验验证码 → 签发 JWT =====================
app.post('/api/verify-code', async (c) => {
  const env = c.env;
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: '请求格式错误' }, 400); }

  const email = normEmail(body.email);
  const code = String(body.code || '').trim();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
    return c.json({ error: '邮箱或验证码格式不正确' }, 400);
  }

  const key = `code:${email}`;
  const rec = await env.AUTH_KV.get(key, { type: 'json' });
  if (!rec) return c.json({ error: '验证码已过期或不存在,请重新获取' }, 400);

  if (rec.attempts >= MAX_ATTEMPTS) {
    await env.AUTH_KV.delete(key);
    return c.json({ error: '尝试次数过多,请重新获取验证码' }, 429);
  }

  if (rec.code !== code) {
    rec.attempts += 1;
    const remaining = Math.ceil((rec.expiresAt - Date.now()) / 1000);
    if (remaining <= 0) {
      await env.AUTH_KV.delete(key);
      return c.json({ error: '验证码已过期,请重新获取' }, 400);
    }
    await env.AUTH_KV.put(key, JSON.stringify(rec), { expirationTtl: remaining });
    return c.json({ error: '验证码不正确', remainingAttempts: MAX_ATTEMPTS - rec.attempts }, 400);
  }

  // 命中 → 先签发 JWT,成功后再一次性删码(签发失败不消耗验证码)
  if (!env.JWT_SECRET) {
    console.error('JWT_SECRET 未配置');
    return c.json({ error: '服务未正确配置(JWT_SECRET)' }, 500);
  }
  const days = parseInt(env.TOKEN_TTL_DAYS || '7', 10);
  const now = Math.floor(Date.now() / 1000);
  const token = await signJWT(
    { sub: email, iat: now, exp: now + days * 86400 },
    env.JWT_SECRET
  );
  await env.AUTH_KV.delete(key);
  return c.json({ token, email });
});

// ===================== ③ 校验 token(供前端守卫强校验) =====================
app.get('/api/verify-token', async (c) => {
  if (!c.env.JWT_SECRET) return c.json({ valid: false, error: '服务未配置' }, 500);
  const auth = c.req.header('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ valid: false }, 401);
  return c.json({ valid: true, email: payload.sub, exp: payload.exp });
});

export default app;
