# 单图 → 3DGS → 视频章节素材

本目录素材取自 Mac3DPlayer 内部马匹样例 `汇报/样例/3DGS/`，不是在线抓取的替身图或模拟点云。页面只在访客点击“加载真实 3DGS 场景”后下载 63 MB PLY。

| 文件 | 来源与用途 |
|---|---|
| `source.png` | `source_preview.png`，原 HEIC 经 ColorSync 转换得到的模型输入 sRGB 工作副本。 |
| `depth.png` | `depth_preview.png`，Metal 渲染器输出的 alpha 加权逆深度归一化预览；白近黑远，不是米制深度真值。 |
| `horse-sharp.ply` | `reconstruction/IMG_7159_sRGB.ply`，Apple SHARP 单图重建，1,179,648 个 degree-0 高斯。保留完整文件及其相机内参、外参元数据；外参为单位矩阵。 |
| `orbit-horizontal.mp4` | `IMG_7159_3DGS_SDR_10s_安全构图裁切.mp4`，同一 PLY 的 ±3° 水平往返运镜，300 帧、30 fps、10 秒，安全裁切后 1920×1080；无音频。 |
| `orbit-cone.mp4` / `cone-poster.png` | `汇报/样例/马匹锥形环绕/horse_cone_SDR.mp4` 与 `horse_cone_poster.png`；同一马匹场景，锥半角 1.5°，右→上→左→下→右的连续圆形轨迹，lookAt 固定主体、不滚转；300 帧、30 fps、10 秒、1920×1080。用于视频输出章节。 |
| `viewer.js` | 以 PLY 内的原始相机内参还原初始视角，将 OpenCV 坐标中的高斯旋转到 WebGL 坐标；鼠标与 WASD 控制自由视角。 |
| `splat-lab.js` / `splat-math.mjs` | 合成高斯教学实验：正交投影协方差、逐像素高斯核、线性 RGB 的 back-to-front alpha 混合。空间线框是斜视示意，非真实 PLY；不代表正式透视 EWA 渲染器的性能或画质。 |

高斯实验新增真实马匹选项：与自由探索共用单一 WebGL Viewer，点击选项后才加载 PLY。投影尺寸直接设置 `SplatMesh.setSplatScale`，不透明度倍率通过 `sceneOpacity` uniform 乘在原有 alpha 上；点状模式使用渲染器的 point-cloud 开关。它们不编辑 PLY、不改变模型输出的三维中心。切回原理实验时真实查看器回到自由探索区并恢复默认外观。
| `lib/` | `@mkkellogg/gaussian-splats-3d` 0.4.7 与 `three` 0.160.0 的浏览器模块，均为 MIT 许可；许可证原文在目录内。 |

源素材与 SHARP 生成内容仅作内部技术演示。Apple SHARP 权重适用 Apple Machine Learning Research 许可；对外发布原图、生成物或模型前需另行核准对应许可。网页开源代码的许可**不**自动覆盖这些素材。

WebGL 查看器与 Mac Metal 渲染器不同，颜色、排序、边缘和性能可能有差异。它展示同一份重建 PLY，但不能视为与 App 完全像素一致的输出。大幅度离开原始相机后会暴露单图未知的遮挡区域。
