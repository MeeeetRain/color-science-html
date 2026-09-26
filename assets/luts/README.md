# EETF LUT — DaVinci Resolve 使用说明

三种 HDR 效能工作模式的色调映射曲线，导出为 `.cube` LUT，用于在 DaVinci 里展示高光压缩效果。

## 文件

| 文件 | 类型 | 说明 |
|---|---|---|
| `eetf_1d_performance4000.cube` | 1D · 4096 点 | 性能模式 **L_target=4000 nit**（拐点 2550 nit，封顶 4000）——4000 nit 面板用 |
| `eetf_1d_performance.cube` | 1D · 4096 点 | 性能模式 L_target=3000 nit，逐通道曲线（最忠实 EETF，文件小） |
| `eetf_1d_balanced.cube` | 1D · 4096 点 | 平衡模式（静态快照 L_target=1500 nit） |
| `eetf_1d_eco.cube` | 1D · 4096 点 | ECO 模式 L_target=600 nit（**旧版**，保留对比用） |
| `eetf_1d_eco800.cube` | 1D · 4096 点 | **ECO 现行设计 L_target=800 nit**（高光预算下限，实测 800 才有明显 HDR 观感） |
| `eetf_1d_eco{500,600,700,1000}.cube` | 1D · 4096 点 | ECO 高光预算探索档（500/600/700/1000），用于对比压缩强度 |
| `eetf_1d_low500.cube` | 1D · 4096 点 | 超低亮度模式 L_target=500 nit |
| `eetf_3d_performance4000.cube` | 3D · 65³ | 性能模式 4000 nit，RGB-max **保色相**压缩 |
| `eetf_3d_performance.cube` | 3D · 65³ | 性能模式 3000 nit，RGB-max **保色相**压缩（高饱和高光不偏色） |
| `eetf_3d_balanced.cube` | 3D · 65³ | 平衡模式（静态快照 1500 nit） |
| `eetf_3d_eco800.cube` | 3D · 65³ | **ECO 现行设计 800 nit，保色相** |
| `eetf_3d_eco{500,600,700,1000}.cube` | 3D · 65³ | ECO 高光预算探索档（与 1D 同名同档） |

**选哪个？**
- **1D**：最精确对应算法曲线，文件小。缺点：极高饱和的高光会有轻微色相偏移（逐通道各自压缩）。
- **3D**：用 max(R,G,B) 算压缩比、三通道同比缩放，**保持色相**。展示霓虹、火焰等高饱和高光时用它。
- 想直观看"越亮越暗有没有修好、三模式压缩差异" → 1D 就够；想看接近成片的保色相效果 → 3D。

## ⚠ 前提：LUT 工作在 PQ 域

这些 LUT 的输入/输出都是 **绝对 PQ（ST 2084）码值**，`[0,1]` 对应 `0–10,000 nit`，色域 Rec.2020 不变（只动亮度，不动色域）。**必须套在 PQ 编码的信号上**，否则结果无意义。

## 加载步骤（DaVinci Resolve）

1. **拷入 LUT 目录**
   Project Settings → Color Management → 点 **Open LUT Folder** →
   把 `.cube` 文件（或整个文件夹）拷进去 → 回 DaVinci 点 **Update Lists**。
   （macOS 默认目录：`/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT/`）

2. **最简展示路径（推荐，不用色彩管理）**
   - Project Settings → Color Management → Color Science = **DaVinci YRGB**（非 Managed）。
   - 时间线放 **HDR PQ 素材**（Rec.2100 / ST 2084）。
   - Color 页面新建一个 serial node → 右键 → **LUT** → `eetf_3d_performance`（或 1D）。
   - 监看设成 HDR PQ。此时 node 里就是原始 PQ 码值，LUT 直接对应。

3. **对比三种模式**
   - 建 3 个版本（Color 页面 clip 右键 → Local Versions → Add Version），每个版本套一个模式的 LUT；或并排 3 个 node 逐一 bypass。
   - 找一个**含明确高光**的镜头（阳光、灯、反光、天空）。看高光区：
     - **性能**：≤1,660 nit 原样，高光最亮最有冲击力。
     - **平衡**：拐点 ~590 nit，高光被适度压向 1,500 nit。
     - **ECO**：拐点 350 nit，高光强压到 800 nit 封顶，最柔和省电（现行设计；用 `eetf_*_eco800`）。
   - 中低亮度（肤色、参考白 203 nit）三模式应完全一致——这是设计要点，可用示波器验证。

## 波形有锯齿 / 台阶？（示波器上曲线呈阶梯状）

阶梯是 **DaVinci 的 3D LUT 插值方式**的产物，**不是 LUT 数据问题**（中性轴数值实测误差仅 1e-8，见下）。按重要性解决：

1. **★ 用 3D LUT 必须把插值改成四面体（Tetrahedral）——这是台阶的主因。**
   `Project Settings → Color Management → 3D lookup table interpolation → 选 Tetrahedral`（默认 Trilinear）。
   DaVinci 默认的三线性插值在灰轴（立方体体对角线）上不是精确线性的，每个网格边界斜率突变 → 规律台阶。四面体插值的四面体公共棱正好是灰轴，沿灰轴就是精确线性插值，台阶几乎消失。**改完若无效，到 LUT 面板右键 Refresh / 重挂节点，排除旧 LUT 缓存。**

2. **灰阶 / 中性 / 示波器精度验证 → 直接用 1D LUT（黄金标准）。**
   灰阶渐变 R=G=B，1D LUT（4096 点）对它是**数学精确**的、完全没有 3D 网格插值，波形绝对平滑。tone mapping 本质就是 1D 操作，1D LUT 是它的原生正确形式；3D LUT 是为色彩/gamut 设计的，套 tone 曲线属次优用法。测试卡、灰阶、单色渐变一律用 `eetf_1d_*`。

3. **3D LUT 已是 65³**（本目录），网格够密；roll-off 输入区间约有 23 个网格点，采样充足——所以关键不是分辨率，而是第 1 条的插值方式。

> 一句话：**灰阶/示波器精度 → 用 1D（数学精确）；高饱和高光保色相 → 用 3D + 必须开 Tetrahedral 插值。**

## 如果用 RCM / DaVinci Wide Gamut（色彩管理工作流）

- 把 Timeline / Output color space 设为 **Rec.2100 ST 2084**。
- LUT 要套在**信号已是 PQ 编码之后**的位置（例如 clip 层最后一个 node，或 timeline node）。
- 不要套在 linear / DWG intermediate 上——那里的 `[0,1]` 不是 PQ 码值，曲线会完全错位。

## 局限（这是"信号域曲线"，不是最终电视观感）

LUT 只实现第 2 节的 tone mapping 曲线，**不含**：
- 第 6 节的高光去饱和（`V' > 0.85–0.9×Vpeak` 渐进泛白）
- 背光 / 局部调光 / ABL / 面板峰值等**显示端硬件行为**
- 平衡模式的**逐场景动态**（LUT 是静态的，这里给的是 L_target=1500 的快照）

所以 LUT 用于**演示三种模式对高光的压缩曲线差异**是准确的；但真实电视上的最终观感还叠加了上述显示端处理。

## 重新生成 / 调参

```bash
python3 scripts/gen_luts.py
```

改 `scripts/gen_luts.py` 里的 `MODES`（模式峰值）、`N1`（1D 点数）、`N3`（3D 尺寸，33→65 更精确）即可。
