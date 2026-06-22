# 编辑规范

这份文档用于约束后续章节写作、资料整理、交互图表和页面发布。目标是让项目长期保持同一种解释方式：准确、可视化、少堆术语，并且能让读者真正建立直觉。

## 1. 内容定位

每篇文章都应先回答一个具体问题，而不是从名词百科开始。

好的章节标题示例：

- SDR 到 HDR 到底变了什么
- 图片色彩管理到底在管什么
- 为什么相机使用 Log 拍摄
- Assign Profile 和 Convert Profile 为什么不是一回事

避免只写成：

- HDR 标准介绍
- ICC Profile 参数
- Gamma 知识点汇总

## 2. 文章结构

推荐结构：

1. **问题场景**：读者在真实工作中会遇到什么困惑。
2. **核心直觉**：用一句话说明这一章真正要解决的事。
3. **基础定义**：只解释后文必须用到的术语。
4. **可交互演示**：让读者拖动、切换、比较。
5. **工作流落地**：放到拍摄、调色、导出、网页显示或显示器适配中解释。
6. **常见误区**：指出容易混淆的概念。
7. **资料来源**：列出可点击的实际链接。

### 2.1 概念章 vs 项目/方法复盘章

上面的结构适用于**概念 / 科普章**（同色异谱、Log、Scene/Display、HDR 色彩科学、图片色彩管理等）：开篇仍然**先抛出一个真实问题或困惑**，再展开原理与演示。

但当一章是在**复盘一个自己做出来的项目、系统或方法**（如 HDR Gain Map 处理流程、"一个章节是怎么做出来的"），换一套更贴近**科研交流**的写法：

- **开篇先点明目标 / 目的**，而不是先讲矛盾。说清楚"这一章要达成什么、做出来有什么用"，例如「提高 HDR gain map 图片的兼容性，实现多格式交付」。把那个触发动机的**问题 / 矛盾降为背景佐证**，跟在目标后面，而不是当标题。
- **正文按科研交流的理解顺序排布**：
  动机 / 目标 → 原理（编码模型 / 基础机制）→ 方法（处理流程 + 核心算法）→ 实现细节（输入解析、边界情况）→ 结果验证（用导出结果反推、对照实验）→ 下游应用 → 小结 / 方法论 → 参考。
- 关键是**方法之前先有一节独立"原理"**：先把编码模型 / 基本机制讲清楚，读者才看得懂后面的流程和公式。
- 工程性、与主题关系不大的内容（部署形态、交互层演进等）**大幅精简**，降为"应用 / 工程落地"的简短一节，不要占据主线。
- 叙事口吻可保留第一人称复盘（"这个项目教会的三件事"），但小节标题要像研究汇报：阶段名（背景 / 原理 / 流程 / 结果验证 / 小结）而不是流水账。

## 3. 写作风格

- 用中文解释优先，英文术语保留在括号或小标题中。
- 每段只讲一个要点，避免长段落堆参数。
- 先讲“为什么”，再讲“公式是什么”。
- 公式旁边必须解释变量含义和坐标轴含义。
- 不把标准名词当作结论，例如不要只说“因为 BT.2100 是这样规定的”，还要解释它解决的问题。
- 避免夸张表达，例如“完美还原”“绝对真实”“唯一正确”。

## 4. 资料核对

涉及以下内容时必须查资料，不凭记忆写：

- 标准参数：PQ、HLG、BT.709、BT.1886、BT.2020、BT.2100、ST 2084、ST 2086。
- HDR 格式：HDR10、HDR10+、Dolby Vision、HLG、HDR Vivid。
- ICC、CSS Color、浏览器色彩管理、平台显示行为。
- 厂商 Log / Gamut 曲线和矩阵。

优先引用：

- ITU-R Recommendations
- SMPTE Standards / Engineering Guidelines
- ICC specification / FAQ
- W3C CSS Color specifications
- Dolby、HDR10+、UWA、Apple、Adobe 官方技术文档

引用要求：

- 页面底部资料来源必须是可点击链接。
- 引用名称应写清楚来源和主题，例如 `ITU-R BT.2100: HDR-TV image parameter values`。
- 如果某个数值是“示意算法”而非真实测量，要在页面中明确说明。

## 5. 交互图表规范

交互图表要帮助理解，不只是让页面看起来复杂。

基本要求：

- 坐标轴必须有名称、单位和数值刻度。
- 曲线必须标注来源或公式，例如 `ST 2084 EOTF`、`BT.2100 HLG OETF`。
- 同一张图里如果比较多条曲线，必须统一坐标意义。
- 如果坐标使用对数、分段线性、归一化值，必须在图内或图下写清楚。
- 鼠标/触控读数要显示当前输入和输出，且单位明确。
- 不把不同物理量硬塞进一张图，除非页面明确说明这是归一化对比。

色度图要求：

- CIE xy 图的 x/y 坐标比例应保持一致，不能把马蹄图横向或纵向拉伸。
- 色域三角形应使用标准原色坐标。
- 如果图形只是示意图，必须标注“示意”。
- 色域面积、色彩体积等指标要写明计算口径，不要用看起来严谨但实际含义模糊的倍数。

## 6. 页面设计规范

- 第一屏直接呈现主题，不做空泛营销。
- 卡片只用于具体信息块，不要卡片套卡片。
- 导航名称要短，读者能一眼知道内容。
- 深色背景下文字对比度要足够，正文不要过灰。
- 按钮、标签、滑块和选项卡的当前状态要明显。
- 移动端不能横向溢出；如果必须横向滚动，要让读者看得出这是可滚动区域。
- 页面中的模式切换要有层级关系，避免读者不知道自己正在看哪种模式。

## 7. 代码规范

目前项目是无构建静态站点，优先保持简单。

- 每个主题页尽量自包含 HTML/CSS/JS，除非出现明显复用需求。
- 不引入大型框架，除非一个章节确实需要复杂状态管理。
- 变量命名要反映物理意义，例如 `peakNit`、`sourceProfile`、`pqCodeValue`。
- 交互图表中的关键公式函数要单独命名，不直接写在绘图循环里。
- 页面可读性优先于过度抽象。
- 修改 JS 后至少运行一次语法检查。

推荐检查：

```bash
perl -0ne 'print $1 if /<script>(.*)<\/script>/s' image-color-management.html > /tmp/page.js
node --check /tmp/page.js
```

## 8. 每日精选数据维护

每日精选内容不直接写进 `index.html` 或 `daily-picks-history.html`。这两个页面只负责读取数据和渲染卡片。

维护入口：

- 只编辑 `data/daily-picks.json`。
- 首页读取 `days[0]` 作为最新推荐。
- 归档页读取 `days` 全部历史，并按文件里的顺序展示。
- `updated` 应与最新一天的 `date` 保持一致。

数据结构：

```json
{
  "updated": "2026-05-25",
  "days": [
    {
      "date": "2026-05-25",
      "picks": [
        {
          "tag": "文章",
          "tagEn": "Article",
          "source": "来源名称 · 主题",
          "sourceEn": "Source name · Topic",
          "title": "文章标题",
          "titleEn": "Article title",
          "description": "中文推荐理由",
          "descriptionEn": "English recommendation reason",
          "url": "https://example.com/article"
        }
      ]
    }
  ]
}
```

内容选择原则：

- 每个工作日推荐 2 条，`picks` 数组必须正好有两项。
- 优先选择科普文章、深度技术文章、教程、案例复盘、有价值的社区讨论。
- 不优先推荐纯规范、参数表、标准 PDF 或只适合查参数的页面。
- 中英双语版本下，推荐为 `tag` / `tagEn`、`source` / `sourceEn`、`title` / `titleEn`、`description` / `descriptionEn` 成对维护；页面也兼容 `zh` / `en` 对象写法，但不要在同一条数据里混用太多风格。
- `description` 直接写推荐原因，不要用“这篇值得读”“这条讨论值得读”这类起手式，也不要复制原文长段落；`descriptionEn` 需表达同一推荐理由，而不是只做字面直译。
- `tag` / `tagEn` 优先使用“科普 / Explainer”“文章 / Article”“讨论 / Discussion”“教程 / Tutorial”“案例 / Case”等短标签。
- 尽量不要连续多天重复同一个链接。

更新检查：

```bash
python3 -m json.tool data/daily-picks.json
node -e "const data=require('./data/daily-picks.json'); console.log(data.updated, data.days[0].date, data.days[0].picks.length)"
```

因为页面通过 `fetch` 读取 JSON，本地检查应使用静态服务器访问：

```bash
python3 -m http.server 8000
```

然后打开 `http://localhost:8000/`。不要只用 `file://` 直接打开页面来检查每日精选区域。

## 9. 新增章节流程

1. 先写选题问题：这个章节解决读者什么困惑。
2. 搜集资料，列出关键来源。
3. 写大纲：问题、核心概念、交互设计、工作流、误区、来源。
4. 制作页面。
5. 检查公式、坐标轴、链接、移动端布局。
6. 更新 `index.html` 入口。
7. 更新 README 的项目内容或后续计划。

## 10. 发布前检查清单

- 页面标题和 meta description 已更新。
- 导航链接可用。
- 所有资料来源链接可点击。
- 如果修改了每日精选，`data/daily-picks.json` 已通过 JSON 语法检查，并已用本地静态服务器确认首页和归档页能加载。
- 交互控件默认状态清晰。
- 图表坐标轴、单位、刻度完整。
- 移动端没有文字溢出或按钮挤压。
- 没有把本地临时文件、未确认版权的 PDF 或大文件误提交。
- `git status` 中只包含本次要发布的文件。

## 11. Git 约定

建议提交信息使用简短英文动词短语：

- `Add image color management page`
- `Refine CIE gamut chart`
- `Update homepage navigation`
- `Fix HLG curve continuity`

提交前确认：

```bash
git status --short
git diff --stat
```

如果仓库里有未跟踪资料文件，先确认是否真的需要发布。不要把研究用 PDF、临时截图或系统文件误提交。

## 12. 手机端适配经验

### 12.1 响应式网格

多列布局（`.grid-2`、`.grid-3`、`.grid-4`、`.kpi-row`、`.section-head`）在 `≤920px` 和 `≤560px` 都需要显式的 `@media` 规则，否则在手机上会挤成极窄的多列。

```css
@media (max-width: 920px) {
  .section-head, .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .kpi-row { grid-template-columns: 1fr; }
}
```

CSS 选择器优先级要注意：如果原始规则是 `.parent .child { ... }`，`@media` 里只写 `.child { ... }` 不够，必须写同等或更高优先级的选择器，否则媒体查询不会覆盖。

### 12.2 Canvas 高度陷阱

`canvas { height: 100% }` 在父元素只有 `min-height` 时**不生效**，canvas 会回退到 HTML 默认高度 **150px**，导致图表只渲染一小条。

根本原因：百分比高度的解析要求父元素有明确的 `height` 值；`min-height` 不算明确高度。

**有效的父元素高度来源：**
- 父元素在 CSS Grid 中，由 `align-items: stretch`（默认）使格子有确定高度 → `height: 100%` 生效。
- 父元素设了明确的 `height: Xpx` → `height: 100%` 生效，即使 `min-height` 更大也没关系（浏览器取 `max(height, min-height)` 作为实际高度）。
- 父元素只有 `min-height` 且不在 grid/flex 内 → `height: 100%` **不生效**。

修复方式：把 `min-height: Xpx` 改为 `height: Xpx`，或在移动端媒体查询里加一条：

```css
@media (max-width: 560px) {
  .gamma-layout .canvas-box,
  .transfer-layout .canvas-box { height: 380px; min-height: 0; }
}
```

如果 canvas-box 有 inline style `min-height`，也要改成 `height`：

```html
<!-- 改前 -->
<div class="canvas-box" style="min-height:240px">
<!-- 改后 -->
<div class="canvas-box" style="height:240px">
```

### 12.3 导航栏手机端

子页面导航链接用 `overflow-x: auto` + `white-space: nowrap` 实现横向滚动即可，不需要额外处理。

首页导航（链接数量多、纵深跳转）：在 `≤640px` 隐藏桌面导航条，改用汉堡按钮 + 下拉面板，JS 切换 `aria-expanded` 和 `.open` 类。点击任意链接后自动关闭菜单。

### 12.4 range 滑块

`input[type="range"]` 如果有 `min-width` 设定，在窄屏会溢出。在 `≤560px` 需要覆盖：

```css
@media (max-width: 560px) {
  input[type="range"] { min-width: 0; width: 100%; }
}
```

### 12.5 发布前手机端核查重点

新增或修改交互图表时，用 DevTools 模拟 375px 宽度，检查：

1. 多列布局是否正确折叠为单列。
2. Canvas 实际渲染高度（`canvas.getBoundingClientRect().height`）是否接近设计值，而不是 150px。
3. readout / tooltip 是否遮挡图表主体内容（加 `max-width` 限制）。
4. range 滑块是否在容器内，没有横向溢出。

## 13. 文案语气规范

项目定位是技术科普和工作流说明，文案应保持清晰、克制、可验证。避免使用明显营销化、拟人化或 AI 腔的比喻。

优先使用：
- “观察者差异”
- “实际问题”
- “明显偏差”
- “显著上升”
- “光谱限制”
- “形成完整工作链路”
- “设计特征”

避免使用：
- “时代的新痛”
- “踩坑 / 翻车”
- “奥秘 / 玄学”
- “突然连成一条线”
- “隐性代价 / 物理学的代价”
- “神器 / 救命”

如果需要解释复杂现象，先写触发条件、影响范围和工作流后果，再给出示例。不要用夸张比喻替代因果关系。
