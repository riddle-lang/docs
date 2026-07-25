# 编辑器与 LSP

Riddle 通过 `riddle-lsp` 为编辑器提供实时诊断、补全和语义高亮。当前仓库提供 Helix、VS Code、Zed 和 IntelliJ IDEA 2026.1+ 的适配文件。

## 准备 riddle-lsp

先按照[安装 Riddle 环境](./install.md)安装工具链，并确认编辑器启动时能找到服务器：

```bash
riddle-lsp --version
```

如果命令不可用，请把 Riddle 二进制目录加入 `PATH`，或在支持路径设置的编辑器中填写 `riddle-lsp` 的绝对路径。JetBrains 插件当前固定从 IDE 进程的 `PATH` 启动服务器。四个适配都会识别 `.rid` 文件；打开 Clue 项目时，服务器会向上查找 `Clue.toml` 并加载项目模块和本地依赖。

## 打包编辑器扩展

在仓库根目录运行 PowerShell 或 Bash 脚本：

```powershell
pwsh -File editors\package.ps1
```

```bash
bash editors/package.sh
```

脚本需要 Node.js、npm、JDK 21 或更高版本和网络连接，Bash 版本还需要 `zip` 命令。首次构建 JetBrains 插件时，Gradle wrapper 会下载 Gradle 9 和 IntelliJ Platform 2026.1 SDK。脚本会在 `editors/dist` 中生成：

| 文件 | 用途 |
|------|------|
| `riddle-vscode.vsix` | 直接导入 VS Code |
| `riddle-intellij.zip` | 从磁盘安装到受支持的 JetBrains IDE |
| `riddle-helix.zip` | 解压后合并到 Helix 配置目录 |
| `riddle-zed.zip` | 解压后作为 Zed Dev Extension 导入 |

JetBrains ZIP 和 VSIX 可以直接安装。Helix 和 Zed 的 ZIP 只负责分发所需文件；导入方式见下文。

## Helix

解压 `editors/dist/riddle-helix.zip`。压缩包内容与仓库中的 `editors/helix` 相同：

```text
editors/helix/
├── languages.toml
└── runtime/queries/riddle/
```

1. 把解压目录中 `languages.toml` 的两个配置块合并到 Helix 配置目录的 `languages.toml`。已有文件时不要直接覆盖。
2. 把解压目录中的 `runtime/queries/riddle` 复制到 Helix 配置目录的 `runtime/queries/riddle`。
3. 重新启动 Helix。

Helix 配置目录通常是：

| 平台 | 路径 |
|------|------|
| Linux / macOS | `~/.config/helix` |
| Windows | `%AppData%\helix` |

直接从仓库导入时，查询文件可以这样复制：

```bash
mkdir -p ~/.config/helix/runtime/queries/riddle
cp editors/helix/runtime/queries/riddle/*.scm ~/.config/helix/runtime/queries/riddle/
```

PowerShell：

```powershell
$queries = Join-Path $env:APPDATA "helix\runtime\queries\riddle"
New-Item -ItemType Directory -Force $queries | Out-Null
Copy-Item editors\helix\runtime\queries\riddle\*.scm $queries
```

默认配置从 `PATH` 启动服务器。需要指定路径或参数时，修改合并后的服务器配置：

```toml
[language-server.riddle-lsp]
command = "/path/to/riddle-lsp"
args = ["--no-std"]
```

补全默认立即响应。需要在持续输入时合并请求，可追加 `--completion-delay-ms`，单位为毫秒：

```toml
args = ["--completion-delay-ms", "25"]
```

检查安装结果：

```bash
hx --health riddle
```

`riddle-lsp`、Tree-sitter parser、Highlight queries、Textobject queries 和 Indent queries 都应显示可用。

## VS Code

VS Code 适配包含 `.rid` 文件注册、基础 TextMate 高亮和 LSP 客户端。当前尚未发布到 Marketplace，需要安装本地 VSIX。

命令行安装打包脚本生成的扩展：

```powershell
code --install-extension editors\dist\riddle-vscode.vsix
```

也可以打开扩展面板，在右上角 `...` 菜单中选择 **Install from VSIX...**，然后选择 `riddle-vscode.vsix`。

安装完成后重新打开 `.rid` 文件。右下角的语言模式应显示 `Riddle`。

扩展默认从 `PATH` 启动 `riddle-lsp`。可以在 `settings.json` 中覆盖路径和参数：

```json
{
    "riddle.server.path": "/path/to/riddle-lsp",
    "riddle.server.arguments": ["--completion-delay-ms", "25"]
}
```

Windows 路径中的反斜杠需要转义：

```json
{
    "riddle.server.path": "C:\\tools\\riddle\\riddle-lsp.exe"
}
```

修改服务器路径或参数后，执行 **Developer: Reload Window** 重新启动扩展。

## IntelliJ IDEA

插件使用 IntelliJ Platform 2026.1 的 LSP integration API，源码全部为 Kotlin。IntelliJ IDEA 2026.1 及更高版本可用；Android Studio 不在当前支持范围内。

1. 打开 **Settings | Plugins**。
2. 点击齿轮菜单，选择 **Install Plugin from Disk...**。
3. 选择 `editors/dist/riddle-intellij.zip`，然后重新启动 IDE。
4. 打开 `.rid` 文件，确认文件类型显示为 `Riddle`，并检查诊断、补全和语义高亮。

插件不向 `riddle-lsp` 传递额外参数，并固定从 IDE 进程的 `PATH` 查找命令。修改系统 `PATH` 后需要完全退出并重新启动 IDE。JetBrains 适配没有 TextMate 或 Tree-sitter 回退；没有启动 LSP 时不会出现 Riddle 语义高亮。

只构建这个插件时，可以运行：

```powershell
Set-Location editors\intellij
.\gradlew.bat buildPlugin
```

生成的版本化 ZIP 位于 `editors/intellij/build/distributions`。

## Zed

Zed 适配当前以 Dev Extension 方式安装。先把 `riddle-zed.zip` 解压到固定目录，并确认该目录顶层包含 `extension.toml`，然后：

1. 在命令面板运行 **zed: extensions**。
2. 选择 **Install Dev Extension**。
3. 选择刚才解压的目录；直接从仓库导入时选择 `editors/zed`。
4. 重新打开 `.rid` 文件，并确认语言模式为 `Riddle`。

扩展默认从工作树的 `PATH` 查找 `riddle-lsp`。也可以在 Zed 的 `settings.json` 中指定路径、参数，并启用完整语义 Token：

```json
{
    "languages": {
        "Riddle": {
            "semantic_tokens": "full"
        }
    },
    "lsp": {
        "riddle-lsp": {
            "binary": {
                "path": "/path/to/riddle-lsp",
                "arguments": ["--completion-delay-ms", "25"]
            }
        }
    }
}
```

修改配置后，在命令面板运行 **language server: restart**。Zed 和 Helix 当前复用 Rust Tree-sitter grammar 作为结构化回退；Riddle 专用的标识符分类由 `riddle-lsp` 语义 Token 提供。

## 当前能力

| 能力 | 状态 |
|------|------|
| `.rid` 文件识别 | Helix、VS Code、Zed、JetBrains 均支持 |
| Clue 项目、未保存文件和未打开模块诊断 | 支持 |
| 解析、类型、move/borrow 诊断 | 支持 |
| Clue 项目级函数、方法、struct、enum、trait、参数和可变绑定语义高亮 | 支持 |
| 跨模块返回类型的局部变量 Inlay Hint | 支持 |
| Clue 项目中的关键字、类型、全局项、局部变量、模式绑定和导入别名补全 | 支持 |
| 字段、实例方法、模块项、枚举变体和关联函数补全 | 支持 |
| 可变闭包绑定 Code Action | 支持 |
| 跨文件补全（包含已打开文件的未保存内容） | 支持 |
| 增量文档同步与 Semantic Token delta | 支持 |
| Hover、跳转定义、查找引用 | 尚未实现 |
| 重命名、格式化 | 尚未实现 |

## 常见问题

### 编辑器提示找不到 riddle-lsp

先在编辑器内置终端运行 `riddle-lsp --version`。如果外部终端可用而编辑器中不可用，请完全退出并重新启动编辑器，让它重新读取 `PATH`；也可以直接配置绝对路径。

### Helix 没有高亮或缩进查询

运行 `hx --health riddle`。如果 queries 显示不可用，检查三个 `.scm` 文件是否位于 Helix 配置目录的 `runtime/queries/riddle` 下。

### Zed 只有基础语法颜色

确认 `languages.Riddle.semantic_tokens` 设置为 `"full"`，然后重启 language server。Zed 默认不会请求完整语义 Token。

### VS Code 有基础高亮但没有诊断

基础高亮由扩展内的 TextMate grammar 提供，不代表 LSP 已启动。检查 `riddle.server.path`，再打开 **Output** 面板查看 `Riddle Language Server` 输出。

### JetBrains 中没有诊断或高亮

确认 IDE 是 2026.1 或更高版本，并把 Gradle JVM 设为 JDK 21 或更高版本；在 IDE 内置终端运行 `riddle-lsp --version`。如果命令不可用，修复 `PATH` 后完全退出并重新启动 IDE；仍有问题时通过 **Help | Show Log** 查看 LSP 启动错误。
