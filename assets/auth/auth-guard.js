// 页面守卫:放在受保护页 <head> 最前(在 auth-config.js 之后)。
// 无 token / token 过期 → 立即跳登录页(同步执行,无内容闪烁)。
// 随后异步向后端校验签名,伪造/失效则清除并跳转。
(function () {
  var cfg = window.AUTH_CONFIG || {};
  var TOKEN_KEY = cfg.TOKEN_KEY || 'siteAuthToken';
  var LOGIN = cfg.LOGIN_PAGE || 'login.html';

  function currentTarget() {
    var file = location.pathname.split('/').pop() || 'index.html';
    return file + location.search + location.hash;
  }
  function go() {
    var target = currentTarget();
    // 同时用 sessionStorage 兜底:有些托管会把 /x.html?q 重定向成 /x 丢掉查询串
    try { sessionStorage.setItem('postLoginNext', target); } catch (e) {}
    location.replace(LOGIN + '?next=' + encodeURIComponent(target));
  }
  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }
  function decodeExp(token) {
    try {
      var p = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      return JSON.parse(atob(p)).exp;
    } catch (e) { return null; }
  }

  var token = null;
  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}

  if (!token) { go(); return; }

  var exp = decodeExp(token);
  if (exp && Date.now() / 1000 > exp) { clearToken(); go(); return; }

  // 强校验(签名 + 有效期),后端不可达时不强制踢出,保证可用性
  if (cfg.AUTH_API_BASE) {
    try {
      fetch(cfg.AUTH_API_BASE + '/api/verify-token', {
        headers: { 'Authorization': 'Bearer ' + token }
      }).then(function (r) {
        if (r.status === 401) { clearToken(); go(); }
      }).catch(function () { /* 网络异常:放行,靠本地 exp 兜底 */ });
    } catch (e) {}
  }
})();
