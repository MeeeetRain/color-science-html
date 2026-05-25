# 影像色彩与显示技术指南

一个面向创作者、影像爱好者和技术学习者的中文影像色彩与显示技术科普项目。项目用静态网页解释 HDR、Log、图片色彩管理、色彩空间、传递函数、显示适配以及后续的显示器/电视技术等概念，重点不是罗列参数，而是把每个概念放回真实影像工作流中讲清楚。

## 项目内容

- `index.html`：项目主页，汇总当前章节入口。
- `data/daily-picks.json`：每日精选数据源。首页读取最新一天，归档页读取全部历史；手动更新推荐时优先编辑这个文件。
- `daily-picks-history.html`：每日推荐归档页，保存历史推荐链接。
- `hdr-color-science.html`：从 SDR 到 HDR 的色彩科学演变，覆盖动态范围、Gamma、PQ/HLG、色彩空间、色彩体积、HDR 格式与对比表。
- `log-gamma.html`：为什么相机使用 Log 拍摄，解释传感器线性数据、Log 曲线和调色工作流。
- `image-color-management.html`：图片色彩管理到底在管什么，解释 RGB 数字、ICC Profile、Assign/Convert、Web 广色域和导出检查。
- `assets/`：页面用到的图片资源。
- `scripts/`：生成或处理资源的辅助脚本。

## 适合谁看

- 想理解 SDR、HDR、PQ、HLG、BT.2020、Display P3 的影像创作者。
- 经常遇到“同一张图在不同软件里变色”的设计师和摄影师。
- 想把色彩科学知识做成可视化教程的学习者。
- 希望用网页交互图表辅助讲课或自学的人。

## 项目特点

- **中文解释优先**：尽量把标准术语转成可理解的工作流语言。
- **交互图表优先**：用滑块、坐标图、对比图帮助读者建立直觉。
- **标准资料优先**：关键公式和参数应回到 ITU、SMPTE、ICC、W3C、厂商技术文档等来源核对。
- **静态部署友好**：项目目前不需要构建工具，直接托管 HTML/CSS/JS 即可。

## 本地查看

推荐在项目目录启动一个本地静态服务器，这样首页和归档页可以正常读取 `data/daily-picks.json`：


```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000/
```

直接用浏览器打开 `index.html` 也能查看大部分静态内容，但部分浏览器会限制本地 JSON 读取，导致每日精选区域无法加载。

## 部署

这是一个静态网站，适合部署到 GitHub Pages、Cloudflare Pages、Netlify 或任何静态文件托管服务。

Cloudflare Pages 的常见设置：

- Build command：留空
- Build output directory：`/` 或留空，取决于平台界面提示
- Root directory：仓库根目录

## 资料与引用原则

页面中的技术结论应尽量来自可追溯资料，优先级建议如下：

1. 标准机构：ITU-R、SMPTE、ISO/CIE、ICC、W3C。
2. 平台与厂商文档：Apple、Adobe、Dolby、HDR10+、UWA/HDR Vivid 等官方资料。
3. 学术论文、技术白皮书、厂商规格说明。
4. 教程、博客和论坛只作为理解辅助，不作为关键参数的唯一来源。

新增章节或修改关键公式时，请同时更新页面底部的资料来源链接。

## 编辑规范

详细写作、交互、视觉和审核规则见 [EDITING_GUIDE.md](EDITING_GUIDE.md)。

## 当前状态

项目仍在持续扩展中。后续计划可以继续加入：

- 显示器校准与 3D LUT
- ACES 与色彩管理工作流
- 色适应与白点转换
- 视频编码、色度抽样与位深
- 摄影机色彩科学与厂商 Log / Gamut 对比

## License

当前仓库尚未明确许可证。正式对外开放前，建议补充一个适合内容与代码复用的 License。
