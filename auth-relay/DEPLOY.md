# auth-relay 部署说明(在你那台常开服务器上执行)

邮箱验证码登录中继:Node + Hono,进程内存存验证码,**agently-cli 发码**,JWT(HS256)。
通过 **Cloudflare Tunnel** 暴露成 HTTPS,供已部署在 Cloudflare Pages 的站点调用。

> 这份说明可以直接交给服务器上的 Claude Code 执行;需要你本人点授权链接的地方它会停下来等你。
> 任何密码都由你本人在自己的终端/浏览器里输入,不要写进任何文件或粘给别人。

前端无需改动逻辑,最后只把隧道地址填进 `assets/auth/auth-config.js` 的 `AUTH_API_BASE` 再重新部署 Pages。

---

## 0. 取代码
```bash
git clone <本仓库地址> color-science && cd color-science/auth-relay
# 或在已 clone 的仓库里 git pull
```

## 1. 装 Node 依赖
```bash
# 需 Node 18+(推荐 20/22)。无 node 先装:nvm 或系统包管理器
npm install
```

## 2. 安装并授权 agently-cli(在这台服务器上单独授权一次)
```bash
npm install -g @tencent-qqmail/agently-cli
agently-cli auth login     # 打印一个授权 URL → 复制到你浏览器点同意
agently-cli +me            # 看到 meetrain@agent.qq.com 即成功
```
> 登录态存在服务器的 keychain/凭据里,和你本地 Mac 互不影响。

## 3. 配置环境变量
```bash
# 生成一段强随机 JWT 密钥(只生成一次,长期固定;改了会让已登录用户全部失效)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
准备这些变量(下一步写进 systemd / pm2):
| 变量 | 值 |
|---|---|
| `JWT_SECRET` | 上面生成的随机串 |
| `ALLOWED_ORIGINS` | 你 Pages 站点的正式地址,例如 `https://你的站点.pages.dev`(多个逗号分隔) |
| `ALLOWED_DOMAIN` | `skyworth.com` |
| `PORT` | `8787` |
| `AGENTLY_BIN` | 若 `agently-cli` 不在 PATH,填它的绝对路径(`which agently-cli`) |

## 4. 常驻运行(二选一)

**A. pm2(简单)**
```bash
npm install -g pm2
JWT_SECRET=... ALLOWED_ORIGINS=https://你的站点.pages.dev ALLOWED_DOMAIN=skyworth.com PORT=8787 \
  pm2 start src/server.js --name auth-relay --update-env
pm2 save && pm2 startup    # 开机自启(按提示再跑一条它给的命令)
```

**B. systemd**(把变量写进 `/etc/auth-relay.env`,创建 `auth-relay.service` 指向 `node .../src/server.js`,`EnvironmentFile=/etc/auth-relay.env`,然后 `systemctl enable --now auth-relay`)

自检:`curl -s localhost:8787/` 应返回 `{"ok":true,"service":"color-science-auth-relay",...}`。

## 5. Cloudflare Tunnel 暴露 HTTPS
```bash
# 安装 cloudflared(各平台见 https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
cloudflared tunnel login                      # 浏览器选你的 Cloudflare 账号 + 一个域名,授权
cloudflared tunnel create auth-relay
# 路由一个子域名到隧道(用你 CF 账号下已有的域名):
cloudflared tunnel route dns auth-relay auth.你的域名.com
# 运行隧道,指向本地中继:
cloudflared tunnel run --url http://localhost:8787 auth-relay
# 常驻:cloudflared service install(或写 systemd)
```
> 快速测试可临时用:`cloudflared tunnel --url http://localhost:8787`,会给一个 `https://xxx.trycloudflare.com` 临时地址(重启会变,正式用命名隧道+你自己的子域名)。

最终拿到一个 HTTPS 地址,例如 `https://auth.你的域名.com`。

## 6. 接上前端(回到本仓库)
把上一步的 HTTPS 地址填进 `assets/auth/auth-config.js`:
```js
AUTH_API_BASE: "https://auth.你的域名.com",   // 末尾不要带 /
```
然后重新部署 Cloudflare Pages(push 触发,或在 Pages 控制台 redeploy)。

## 7. 验收
- 浏览器开任一受保护页(未登录)→ 跳 login → 填 `@skyworth.com` 邮箱 → **真实收到验证码邮件** → 登录 → 跳回原页。
- 接口冒烟:`POST /api/send-code`(非 @skyworth.com 应 403;连发应 429),错码 5 次 429,正确码返回 token。

## 排错
- 发码 502:服务器上 `agently-cli +me` 是否还在授权态;`AGENTLY_BIN` 路径;`agently-cli message +send ... --dry-run` 单独验证。
- 浏览器报 CORS:`ALLOWED_ORIGINS` 必须**精确**等于站点 origin(含 `https://`、无结尾 `/`)。
- 浏览器报 mixed content:`AUTH_API_BASE` 必须是 `https://`(隧道地址),不能是 `http://IP`。
- agently 每天 50 封额度;超量发码会 502。
