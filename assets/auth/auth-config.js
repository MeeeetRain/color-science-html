// 登录系统前端配置 —— 唯一需要手改的地方
window.AUTH_CONFIG = {
  // 中继后端地址(末尾不要带斜杠)。当前为 Cloudflare 快速隧道(临时地址):
  // 服务器上 cloudflared 进程重启后此地址会变 —— 变了就更新这里并重新部署 Pages。
  // 以后接了自定义域名,改成固定的命名隧道地址即可。
  AUTH_API_BASE: "https://gold-interest-cakes-lucia.trycloudflare.com",
  TOKEN_KEY: "siteAuthToken",
  LOGIN_PAGE: "login.html"
};
