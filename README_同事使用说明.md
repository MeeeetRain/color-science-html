# Dolby Vision SourceLed_Subj 一键部署包

## 这个文件夹里有什么

| 文件 | 说明 |
|------|------|
| `Dolby_Vision_PQ_Kit_5.2.1.2_GA_Full_Kit.zip` | Dolby 官方 SDK 完整包（1.9GB），包含测试工具、测试向量、文档 |
| `给AI的提示词.md` | **核心文件**。复制给 AI 助手，AI 会按步骤完成全部安装配置和视频生成 |

## 怎么用（3 步）

### 第 1 步：打开 AI 助手
推荐用 WorkBuddy（本工具），也可以用 Claude / ChatGPT 等能执行命令的 AI。

### 第 2 步：把提示词发给 AI
打开 `给AI的提示词.md`，复制分隔线 `---` 之间的全部内容，粘贴给 AI。

同时告诉 AI 这个 zip 文件的路径，例如：
> SDK 压缩包在 `D:\xxx\DolbyVision一键部署包\Dolby_Vision_PQ_Kit_5.2.1.2_GA_Full_Kit.zip`

### 第 3 步：按 AI 提示提供 EDID 文件
AI 会自动完成 Python 检查、FFmpeg 安装、SDK 解压、dvsg 安装。环境就绪后它会问你索要 **被测 TV 的 E-EDID 文件**（.bin 格式，用 Unigraf UCD-323 抓取）。

把 EDID 文件路径告诉 AI，它会自动生成 SourceLed_Subj 测试视频。

## 生成的东西在哪

AI 完成后，测试信号在：
```
<SDK解压目录>\Test_Vectors\Verification\HDMI\Video\SourceLed_Subj_v5.0\Video\
```
里面有约 46 个 `Video_XXXX.bin` 文件，用 Unigraf UCD-323 加载场景文件播放：
```
<SDK解压目录>\Test_Vectors\Verification\HDMI\Scenarios\PQ_Sub_SourceLed_v5.0_FHD24.txt
```

## 注意事项

- **不同 TV 型号必须用各自的 EDID** 重新生成，不能混用
- dvsg 必须装在 **Python 3.12** 下（不是 3.13），因为 numpy 兼容性问题——提示词里已写明，AI 会处理
- 整个安装配置过程首次约需 20-40 分钟（主要是下载 FFmpeg），之后换 TV 型号重新生成只需 30 秒
- 如果 AI 是 WorkBuddy，它有文件系统和命令执行能力，能完全自动完成

## 环境要求

- Windows 10/11
- 至少 20GB 可用磁盘空间
- 管理员权限（用于安装 Python、修改 PATH 环境变量）
- 网络连接（下载 FFmpeg）
