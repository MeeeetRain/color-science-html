# 单图 → 3DGS → 视频章节素材

本目录素材取自 Mac3DPlayer 内部马匹样例 `汇报/样例/3DGS/`，不是在线抓取的替身图或模拟点云。页面只在访客点击“加载真实 3DGS 场景”后下载 **23.4464 MiB** 的紧凑模型。保留全部 1,179,648 个高斯，不删点；参数轻量量化，字节重排与 gzip 本身可逆。URL 加 `?asset=original` 可加载原始无损分片作对照。

| 文件 | 来源与用途 |
|---|---|
| `source.png` | `source_preview.png`，原 HEIC 经 ColorSync 转换得到的模型输入 sRGB 工作副本。 |
| `depth.png` | `depth_preview.png`，Metal 渲染器输出的 alpha 加权逆深度归一化预览；白近黑远，不是米制深度真值。 |
| `horse-sharp.ply`（仅本地保留） | `reconstruction/IMG_7159_sRGB.ply`，Apple SHARP 单图重建，1,179,648 个 degree-0 高斯。保留完整文件及其相机内参、外参元数据；外参为单位矩阵。 |
| `horse-sharp.ksplat.shuf4.gz` | 默认加载的紧凑模型；保留全部高斯点，KSplat level 1 参数量化后进行可逆字节重排与 gzip 压缩。 |
| `horse-sharp.manifest.json` / `horse-sharp.*.bin` | 原始 PLY 按字节拆成最多 24 MiB 的三片，满足 Cloudflare Pages 的单文件限制。清单记录顺序、大小、每片及整文件 SHA-256；模型属性、点数、字节顺序和精度均不变。 |
| `model-parts.mjs` | 按清单加载并校验各片，拼接为 PLY Blob，再交给原有渲染器；失败可重试，读取完成后释放临时 URL。 |
| `orbit-horizontal.mp4` | `IMG_7159_3DGS_SDR_10s_安全构图裁切.mp4`，同一 PLY 的 ±3° 水平往返运镜，300 帧、30 fps、10 秒，安全裁切后 1920×1080；无音频。 |
| `orbit-cone.mp4` / `cone-poster.png` | `汇报/样例/马匹锥形环绕/horse_cone_SDR.mp4` 与 `horse_cone_poster.png`；同一马匹场景，锥半角 1.5°，右→上→左→下→右的连续圆形轨迹，lookAt 固定主体、不滚转；300 帧、30 fps、10 秒、1920×1080。用于视频输出章节。 |
| `viewer.js` | 以 PLY 内的原始相机内参还原初始视角，将 OpenCV 坐标中的高斯旋转到 WebGL 坐标；鼠标与 WASD 控制自由视角。 |
| `splat-lab.js` / `splat-math.mjs` | 合成高斯教学实验：正交投影协方差、逐像素高斯核、线性 RGB 的 back-to-front alpha 混合。空间线框是斜视示意，非真实 PLY；不代表正式透视 EWA 渲染器的性能或画质。 |

高斯实验新增真实马匹选项：与自由探索共用单一 WebGL Viewer，点击选项后才加载 PLY。投影尺寸直接设置 `SplatMesh.setSplatScale`，不透明度倍率通过 `sceneOpacity` uniform 乘在原有 alpha 上；点状模式使用渲染器的 point-cloud 开关。它们不编辑 PLY、不改变模型输出的三维中心。切回原理实验时真实查看器回到自由探索区并恢复默认外观。
| `lib/` | `@mkkellogg/gaussian-splats-3d` 0.4.7 与 `three` 0.160.0 的浏览器模块，均为 MIT 许可；许可证原文在目录内。 |

源素材与 SHARP 生成内容仅作内部技术演示。Apple SHARP 权重适用 Apple Machine Learning Research 许可；对外发布原图、生成物或模型前需另行核准对应许可。网页开源代码的许可**不**自动覆盖这些素材。

WebGL 查看器与 Mac Metal 渲染器不同，颜色、排序、边缘和性能可能有差异。它展示同一份重建 PLY，但不能视为与 App 完全像素一致的输出。大幅度离开原始相机后会暴露单图未知的遮挡区域。

## 更新模型

压缩版 `horse-sharp.ksplat.shuf4.gz` 为 24,585,365 字节，小于 25 MiB；原 PLY 为 66,061,086 字节，下载量减少约 62.8%。SHA-256：`fb092088a9211ec01048a4578cd65ebf5369047f9daefa14313ef4e056ade619`。

使用 GaussianSplats3D 0.4.7 的 `PlyParser.parseToUncompressedSplatArray(input, 0)` 与 `SplatBufferGenerator.getStandardGenerator(0, 1)`：alpha 阈值为零，完整保留高斯。KSplat level 1 使用桶相对 uint16 位置、float16 尺度与旋转；浏览器既有路径的颜色/alpha 同为 uint8。28,421,404 字节 KSplat 经四通道字节转置 `shuffled[j*n+i]=raw[i*4+j]` 后 gzip level 9。浏览器解 gzip、逆转置，交给 KSplat 加载器；需支持 DecompressionStream 的浏览器。

2026-09-26 验证：9216 点抽样位置误差最大 0.000066 场景单位、尺度相对误差最大 0.0967%、归一化旋转误差最大 0.0445°。拍摄点与右/左/上/下五个相同近邻视角截图 PSNR 为 50.009–50.405 dB，平均绝对差 0.211–0.214/255。这里是显示空间截图指标，不是线性 HDR 指标；目视未发现明显细节或遮挡边缘退化，但不代表任意视点完全无损。证据在 `output/playwright/compression/`，包含原版/压缩版截图、8 倍差异图与 metrics.json。

原始 PLY 保留在本地，但不作为 Pages 部署文件上传。重新分片：

```bash
node scripts/split-3dgs-model.mjs
node --test scripts/model-parts.test.mjs
```

无损对照版本需要将清单与全部分片一起提交发布。文件名含模型哈希，避免 CDN 将不同版本的分片混用。分片本身不减少总下载量；默认紧凑模型减少下载量约 62.8%。两种加载方式均不改变视频编码、相机设置或查看器的渲染参数。
