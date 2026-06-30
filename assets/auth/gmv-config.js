// gainmapvideo-player 页专用登录配置 —— 独立于邮箱登录的三页(单独的 token key + 密码登录页)
window.AUTH_CONFIG = {
  // 与邮箱登录共用同一个 relay;隧道地址变了这里也要同步更新
  AUTH_API_BASE: "https://gold-interest-cakes-lucia.trycloudflare.com",
  TOKEN_KEY: "gmvAuthToken",
  LOGIN_PAGE: "gmv-login.html"
};
