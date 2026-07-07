# Dolby Vision SourceLed_Subj 测试信号一键生成 — 给 AI 的提示词

> **使用方法**：把下面分隔线之间的全部内容复制给任意 AI 助手（如 WorkBuddy / Claude / ChatGPT 等），并把本文件夹里的 `Dolby_Vision_PQ_Kit_5.2.1.2_GA_Full_Kit.zip` 也发给它（或告诉它 zip 的路径）。AI 会自动完成环境安装、配置，并向你索要 TV 的 EDID 文件后生成测试视频。

---

## 任务

我是 Dolby Vision TV 画质调参工程师，需要在本机（Windows）生成 **SourceLed_Subj 主观测试信号**（用于 Unigraf UCD-323 播放）。

请按以下步骤完成环境的安装、配置，并向我索要 EDID 文件后生成测试视频。每一步都要实际执行命令验证，不要只说不做。

## 第一步：确认 Python 环境

1. 运行 `py -0` 列出已安装的 Python 版本。
2. 确认存在 **Python 3.12.x**（任意 3.12 版本均可）。如果没有，请安装 Python 3.12（从 https://www.python.org/downloads/ 下载）。
3. 同时确认默认的 `py -3` 指向的版本（记录下来）。

> **重要说明**：dvsg 工具依赖 `numpy<2.0`。Python 3.13 **没有** numpy 1.x 的预编译 wheel，且本机通常没有 VS 编译环境，会导致 `pip install` 失败（报 meson 编译错误）。因此 **dvsg 必须安装在 Python 3.12 下**（3.12 有预编译 wheel）。这是已验证过的关键经验。

## 第二步：安装 FFmpeg

1. 检查是否已安装 FFmpeg：运行 `ffmpeg -version`。
2. 如果未安装或版本低于 4.3.1，执行以下安装：
   - 下载 `https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip`（约 100MB+，用 curl 或 PowerShell `Invoke-WebRequest` 下载，下载较慢请耐心等待）
   - 解压到 `C:\Users\<用户名>\ffmpeg\`（确保 bin\ffmpeg.exe 在该路径下）
   - 把 `C:\Users\<用户名>\ffmpeg\bin` 加入用户 PATH 环境变量
   - 验证 `ffmpeg -version` 能正常输出（版本应为 8.x）
3. 记录最终 ffmpeg.exe 的完整路径，后续要用。

## 第三步：解压 SDK

本文件夹内有一个 `Dolby_Vision_PQ_Kit_5.2.1.2_GA_Full_Kit.zip`（约 1.9GB）。请：

1. 把它解压到一个工作目录（建议解压到当前工作区，路径中避免中文和空格）。
2. 解压后得到的根目录下应有三个子项：`Documentation/`、`Test_Tools/`、`Test_Vectors/`，以及一个 `Start_Here.html`。
3. 把这个 SDK 根目录的完整路径记下来，后续所有命令都要用到（下文用 `<SDK>` 代指）。

## 第四步：复制 FFmpeg 到 SDK 工具目录

Dolby 文档要求把 ffmpeg.exe 放到 SDK 的工具目录。执行：

```
copy "C:\Users\<用户名>\ffmpeg\bin\ffmpeg.exe"  "<SDK>\Test_Tools\scripts\tools\ffmpeg.exe"
```

验证该文件存在。

## 第五步：安装 dvsg 工具

**必须用 Python 3.12 安装**（不要用 3.13）。执行：

```
py -3.12 -m pip install --disable-pip-version-check --upgrade --force-reinstall "<SDK>\Test_Tools\scripts\dlb_app_dvsg\dist\dlb_app_dvsg-1.8.1-py3-none-any.whl"
```

安装成功后：
- dvsg.exe 会安装在 `C:\Users\<用户名>\AppData\Roaming\Python\Python312\Scripts\` 下
- 把这个 Scripts 目录加入用户 PATH 环境变量
- 运行 `dvsg --help` 验证能正常输出帮助信息（应显示 version 1.8.1）

> 如果 pip 报错提到 meson / VS 编译 / numpy 编译失败，说明你用了 Python 3.13，请改用 `py -3.12`。

## 第六步：向用户索要 EDID 文件

环境就绪后，**停止并询问我**：

> "环境已配置完成（Python / FFmpeg / dvsg 均就绪）。请提供被测 TV 的 E-EDID 二进制文件路径（.bin 文件，通常 256 字节，可用 Unigraf UCD-323 抓取）。不同 TV 型号必须用各自的 EDID。"

等我回复 EDID 文件路径后，再执行第七步。

## 第七步：生成 SourceLed_Subj 测试信号

用我提供的 EDID 路径替换下面命令中的 `<EDID路径>`，然后执行（建议在 SDK 根目录下运行，日志会生成在当前目录的 dvsg.log）：

```bat
set SDK=<SDK根目录的完整路径>

dvsg --log dvsg.log ^
  --tools "%SDK%\Test_Tools\scripts\tools" ^
  --ifs "%SDK%\Test_Vectors\Dolby_Vision\HDMI\Infoframes" ^
  --tbs "%SDK%\Test_Vectors\Verification\HDMI\cfg\tbs.json" ^
  --tcs "%SDK%\Test_Vectors\Verification\HDMI\cfg\tcs_src_led.json" ^
  -o "%SDK%\Test_Vectors\Verification\HDMI\Video" ^
  --check-cfg 0 ^
  --hdmi-edid <EDID路径>
```

> 注意：如果 dvsg 命令找不到，说明 PATH 没生效，可直接用完整路径：
> `C:\Users\<用户名>\AppData\Roaming\Python\Python312\Scripts\dvsg.exe`

## 第八步：验证生成结果

1. 检查 dvsg.log 中是否有 `Test signal generation completed` 且无 error/fail。
2. 确认输出目录 `<SDK>\Test_Vectors\Verification\HDMI\Video\SourceLed_Subj_v5.0\` 下：
   - `Video\` 子目录有约 46 个 `Video_XXXX.bin` 文件（每个约 8.3MB）
   - `Event\` 子目录有 Infoframe 文件
   - `SourceLed_Subj_v5.0.json` 配置文件
3. 向我报告生成结果（文件数量、耗时、日志关键行）。

## 第九步：告知播放方式

生成完成后，告诉用户：

- 播放设备：Unigraf UCD-323
- 场景文件：`<SDK>\Test_Vectors\Verification\HDMI\Scenarios\PQ_Sub_SourceLed_v5.0_FHD24.txt`
- 该场景文件会调用刚生成的 `SourceLed_Subj_v5.0\Video\` 下的 bin 文件
- 此信号为该 EDID 对应 TV 型号专用，其他型号需用各自 EDID 重新生成

## 背景知识（供 AI 参考）

- **SourceLed（源端引导）**：Dolby Vision 的一种处理模式，元数据在源端（播放器/信号发生器）生成并通过 HDMI VSIF 传递给 TV，TV 仅做 tone mapping。与之相对的是 SinkLed（sink 端/sink 引导），元数据在 TV 端生成。
- **主观测试（Subjective）**：通过人眼对比被测 TV 与参考显示器的画面质量，检查白点、测试色、自然图像等。
- **E-EDID**：增强型扩展显示标识数据，TV 通过它向信号源声明自己的能力（支持的格式、Dolby Vision 版本等）。dvsg 根据 EDID 生成匹配该 TV 的测试信号。
- **dvsg**：Dolby Vision Signal Generator，Dolby 官方工具，根据测试用例配置（tcs_src_led.json）和 TV 的 EDID 生成 HDMI 测试信号（bin 格式，供 UCD-323 播放）。

---
