# 连连看

几年前的 C++ / EasyX 课程大作业，重新整理成可构建、可直接运行的项目。保留原有的黑色棋盘、头像图案、闯关方式和 **Cyberangel - hanser** 背景音乐，简单整理了状态栏、选中边框与中文字体。

项目自带的 25 张头像就是原文件夹 `Images/Profile/1.png` 至 `25.png`，图片与音乐文件保持原样。

## 运行

在 [Releases 下载 Windows 便携包](https://github.com/GXinnnnnn/dsh-plugin-vehicle-ui/releases/latest)，完整解压后双击 **LinkGame.exe**。也可以在源码目录中构建，打开 `dist/LinkGame/LinkGame.exe`。

适用于 Windows 10 1903 及以上 / Windows 11，64 位。程序静态链接 C++ 运行库与 EasyX，运行时无需安装 Visual Studio、EasyX、Python 或 Node.js。

**EXE、Images、sound 必须放在一起。** 请勿只复制 EXE，也不要在压缩包里直接运行。程序不需要联网。

## 规则与操作

- 棋盘为 **8×8，共 64 张图案**。依次点击两个相同头像，连接路径最多由三条水平 / 垂直直线组成，即**最多拐两次弯**。
- 路径不能穿过其他头像，允许从棋盘外围的一圈空白绕行；不能与自身配对。
- 清除全部 32 对后通关，可选择进入下一关。没有可消除的图案时会自动重新排列剩余图案。
- 第一关 240 秒，此后每关减少 5 秒，最低 30 秒。超时可选择从第一关重开。
- 每关提供 4 次空格提示。这里的“提示”会显示连线并**直接消除一对**，与原版一致。
- 第二关起，消除后剩余图案会向某个方向靠拢：第 2–9 关依次为左、右、上、下、左上、右上、左下、右下，第 10 关起为左下（沿用原代码的默认方向）。

| 操作 | 方式 |
| --- | --- |
| 配对消除 | 鼠标左键依次点击两个头像 |
| 提示并消除一对 | 空格，消耗一次提示 |
| 连续自动消除当前能连接的图案 | Tab，保留原版功能；遇到无解布局会交回主循环洗牌 |
| 保存 / 保存后退出 | Esc，按弹窗选择 |
| 读取进度 | 启动弹窗选择“读档开始” |
| 退出 | 关闭窗口；关闭前需要保留进度请先 Esc 保存 |

键盘操作在游戏窗口获得焦点时生效。开始选择、存档选择和通关等弹窗期间不扣时间。存档是 EXE 旁的 `memory.txt`，虽然扩展名是 txt，实际是二进制文件，请不要手工编辑；需要在可写目录运行。旧工程其他棋盘尺寸或已损坏的存档会被拒绝并开始新游戏。

## 图片库：换成自己想玩的内容

```text
LinkGame.exe
Images/
└─ Profile/
   ├─ 1.png
   ├─ 2.png
   ├─ ...
   └─ 25.png
sound/
└─ Cyberangel - hanser.mp3
```

### 直接替换，不需要编译

1. 退出游戏，备份整个 `Images/Profile` 文件夹。
2. 把新头像保存成**真正的 PNG 文件**，分别覆盖 `1.png`、`2.png`……`25.png`。不要只把 JPG 的扩展名改成 PNG。
3. 保持 **25 个编号文件完整**。例如想把第一种图案换成你的头像，就替换 `1.png`；不要删除后面的文件，启动时会检查 25 张图。
4. 推荐正方形图片；显示时统一缩放到 **100×100**。不必修改原文件的大小。非正方形会拉伸，EasyX 当前贴图方式不保留透明效果，建议准备好底色。
5. 重新启动。换图后建议“直接开始”新游戏，避免把旧存档的编号理解成另一套图片。

**图片身份按编号区分，不按图像内容识别。** 不同编号不要放看起来完全一样的图，否则视觉上相同的头像可能无法配对。每种头像只需准备一张，程序自行生成成对方块。

当前延续原代码的 **18 种有效图案**：`1.png` 对应 A，`2.png` 对应 B，依此至 `18.png` 对应 R；`19.png` 至 `25.png` 保留在库中并加载，但默认不参与棋盘生成。如果想把全部 25 种都用于游戏，将 `src/llk.cpp` 中 `CreateMap()` 的 `i % 18` 改为 `i % 25`，再重新编译。不要扩大到超过 25，除非同时调整加载数量和字母映射。

### 维护多套图库

可以在项目外分别保存 `崩坏头像库/Profile/`、`其他主题/Profile/`，需要切换时把所选主题内的 `1.png`–`25.png` 覆盖到游戏的 `Images/Profile/`。游戏只读取这个固定目录，没有新增主题菜单，保持原版操作方式。

### 替换音乐

将自己的 MP3 覆盖到 `sound/Cyberangel - hanser.mp3`，保持完整文件名不变，重启后循环播放。缺失音乐不会阻止棋盘运行。原 MP3 与头像按原文件字节保留，构建脚本直接复制，不进行音频或图像转换。

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 主体 | C++，保留原 main.cpp / llk.cpp / llk.h 结构 |
| 图形与输入 | EasyX 26.10.25、Win32 API；原 100 像素格子与黑色棋盘 |
| 连通规则 | 直线、两段、三段路径分层判定；外围空白寻路 |
| 关卡 | 二维字符数组、成对随机布局、图案移动与无解洗牌 |
| 音频 | Windows MCI / winmm，循环播放 MP3 |
| 存档 | C 文件读写，二进制 memory.txt |
| 构建 | w64devkit 2.11.0 / MinGW-w64 GCC、PowerShell、7-Zip |

源码整理为 UTF-8；EasyX 使用 Unicode 接口，统一采用微软雅黑绘制中文，EXE 清单启用 Windows UTF-8 活动代码页。源码里保留了部分原始注释与函数名，便于对照学习。

## 从源码构建 EXE

需要 Windows 64 位、PowerShell 5.1 及以上，以及 [7-Zip](https://www.7-zip.org/)。先在项目根目录运行：

```powershell
# 下载固定版本编译器和 EasyX，并检查 SHA-256 后解压至 .tools
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup.ps1

# 编译、运行核心回归测试、生成便携 ZIP
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\build.ps1 -Test
```

7-Zip 不在默认路径时：

```powershell
.\scripts\setup.ps1 -SevenZip 'D:\7-Zip\7z.exe'
```

已准备依赖时可传 `-ToolchainRoot`（含 bin/g++.exe 的 w64devkit 目录）和 `-EasyXRoot`（含 include/ 和 lib_mingw_msvcrt/ 的 EasyX 目录），无需重复下载。输出：

```text
dist/LinkGame/LinkGame.exe
dist/LinkGame/Images/Profile/1.png ... 25.png
dist/LinkGame/sound/Cyberangel - hanser.mp3
dist/LinkGame-v1.0.0-windows-x64.zip
```

如果只改图片或音乐，直接替换 EXE 旁的素材即可；修改源码才需要编译。不要使用之前遗留的 Debug EXE，它依赖开发版运行库。docs/github-actions-example.yml 提供可选的自动构建示例；当前登录凭据没有 workflow 权限，尚未启用云端构建。需要时可自行将示例放到 .github/workflows/build.yml，再执行云端构建与核心测试。

`-Test` 直接测试当前 C++ 游戏逻辑，覆盖路径、偶数配对、地图移动与 120 次完整模拟对局。本机还可加 `-MediaTest` 解码 25 张图片并短暂播放 / 停止 MP3；该检查需要音频播放环境，因此不在 CI 中运行。验证范围见 [docs/validation.md](docs/validation.md)。

## 项目目录

```text
src/              C++ 游戏源码、Windows 清单与资源入口
Images/Profile/   原来的 25 张头像，可按编号覆盖
sound/            原来的 Cyberangel MP3
scripts/          准备依赖、构建 EXE 与 ZIP
tests/            直接调用 C++ 核心逻辑的回归测试
docs/             验证记录与自动构建示例
.tools/           本地编译依赖（不提交）
dist/             本地产物（通过 Releases 分发）
```

## 整理范围

在原画面的基础上统一中文字体、整理顶部状态信息和底部按键说明，保留原素材、音乐与玩法。修正旧路径不匹配、键盘依赖控制台焦点、点击边缘数组越界、图案数量不成对、无解被误判通关、无限洗牌、二进制存档使用文本模式，以及跨线程绘图等影响运行的问题。

原 Visual Studio 工程、旧 Debug 产物、缓存数据库和个人存档已在本机另行备份，未混入当前源码目录。仓库沿用原 URL，内容已替换为本连连看项目；旧 Git 历史保留。

依赖来源：[EasyX 官网](https://easyx.cn/easyx)、[EasyX 文档](https://docs.easyx.cn/)、[w64devkit 官方发布](https://github.com/skeeto/w64devkit/releases/tag/v2.11.0)。构建依赖不作为项目源码上传。图片、音乐与第三方库的权利归各自权利人；当前未擅自给原代码或第三方素材添加开源授权。
