# 登录系统部署说明（auth-worker）

邮箱验证码登录后端：Cloudflare Worker (Hono) + KV + Resend + JWT。
前端 `login.html` / `assets/auth/*` 已在站点根目录就位。

---

## 一、本地联调（不需要 Resend，验证码走日志）

```bash
cd auth-worker
npm install
npm run dev          # = wrangler dev --var ENVIRONMENT:dev，默认 http://localhost:8787
```

- dev 模式不真正发邮件，验证码会打印在 `wrangler dev` 终端，并随 `/api/send-code` 响应里的 `devCode` 返回（仅 dev）。
- 另开一个终端起静态站：`cd ..` 然后 `npx serve -l 8765`（或现有 launch.json 的 static）。
- 浏览器开 `http://localhost:8765/login.html`，输入 `someone@skyworth.com` → 发码 → 用终端里的码登录。
- `assets/auth/auth-config.js` 里的 `AUTH_API_BASE` 默认已是 `http://localhost:8787`，本地无需改。

---

## 二、上线部署（需要你的账号/密钥，我无法代做）

### 1. Resend（发信）
1. 注册 https://resend.com → 拿 API Key。
2. 验证一个发信域名（能改 `skyworth.com` 的 DNS 最好；否则先用你掌控的域名）。
   - 仅想先测：可临时把 `wrangler.toml` 的 `FROM_EMAIL` 设为 `onboarding@resend.dev`（只能发到你注册 Resend 的那个邮箱）。
3. 把 `wrangler.toml` 里 `FROM_EMAIL` 改成你验证过的发件地址，例如：
   `FROM_EMAIL = "影像色彩指南 <noreply@你的域名>"`

### 2. Cloudflare
```bash
cd auth-worker
npx wrangler login                      # 浏览器 OAuth 授权
npx wrangler kv namespace create AUTH_KV
```
把返回的 `id = "..."` 填进 `wrangler.toml` 的 `[[kv_namespaces]]`。

### 3. 设置机密（值由你输入，不要写进文件）
```bash
npx wrangler secret put RESEND_API_KEY  # 粘贴 Resend 的 API Key
npx wrangler secret put JWT_SECRET      # 粘贴一段强随机串，见下
```
生成强随机 JWT 密钥：
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 4. 配置允许的站点来源（CORS）
把 `wrangler.toml` 的 `ALLOWED_ORIGINS` 改成你站点真实地址，例如：
`ALLOWED_ORIGINS = "https://你的站点域名"`（多个用逗号分隔；联调端口可保留）。

### 5. 部署
```bash
npx wrangler deploy
```
拿到 Worker 地址（形如 `https://color-science-auth.<子域>.workers.dev`）。

### 6. 接上前端
把 Worker 地址填进 `assets/auth/auth-config.js` 的 `AUTH_API_BASE`（末尾不要带 `/`）。

---

## 三、受保护页面

已在以下三页 `<head>` 注入守卫脚本：
- `ltx-gainmap-itm.html`
- `sdr-hdr-chroma-luminance-tuning.html`
- `rgbminiled-testtool-design.html`

增减保护页：在目标页 `<head>` 顶部加这两行即可（顺序不能反）：
```html
<script src="assets/auth/auth-config.js"></script>
<script src="assets/auth/auth-guard.js"></script>
```

> ⚠️ 这是**前端软拦截**：能挡普通访客，但懂技术的人可绕过（看源码 / 禁 JS / 直接请求文件）。
> 若日后要真正的访问控制，需把这些页放到服务端网关后（如 Cloudflare Pages Functions 中间件按 JWT 校验）再返回 HTML。

---

## 四、接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/send-code` | body `{email}`，校验 `@skyworth.com` + 限流 → 发 6 位码（KV 存 5 分钟） |
| POST | `/api/verify-code` | body `{email,code}`，校验通过删码并返回 `{token}`（JWT，默认 7 天） |
| GET  | `/api/verify-token` | header `Authorization: Bearer <token>`，校验签名+有效期 |

可调参数在 `src/index.js` 顶部常量；`wrangler.toml [vars]` 可改域名白名单、发件人、token 时长等。
