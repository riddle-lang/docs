# 编辑器与 LSP

Riddle 通过 `riddle-lsp` 为编辑器提供实时诊断和语义高亮。当前仓库提供 Helix、VS Code 和 Zed 的适配文件。

## 准备 riddle-lsp

先按照[安装 Riddle 环境](./install.md)安装工具链，并确认编辑器启动时能找到服务器：

```bash
riddle-lsp --version
```

如果命令不可用，请把 Riddle 二进制目录加入 `PATH`，或在编辑器配置中填写 `riddle-lsp` 的绝对路径。三个适配都会识别 `.rid` 文件；打开 Clue 项目时，服务器会向上查找 `Clue.toml` 并加载项目模块和本地依赖。

## 打包编辑器扩展

在仓库根目录运行 PowerShell 或 Bash 脚本：

```powershell
pwsh -File editors\package.ps1
```

```bash
bash editors/package.sh
```

脚本需要 Node.js、npm 和网络连接，Bash 版本还需要 `zip` 命令。它会安装 VS Code 扩展的构建依赖，并在 `editors/dist` 中生成：

| 文件 | 用途 |
|------|------|
| `riddle-vscode.vsix` | 直接导入 VS Code |
| `riddle-helix.zip` | 解压后合并到 Helix 配置目录 |
| `riddle-zed.zip` | 解压后作为 Zed Dev Extension 导入 |

Helix 和 Zed 没有与 VSIX 等价的本地安装包，因此对应 ZIP 只负责分发所需文件；导入方式见下文。

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
    "riddle.server.arguments": []
}
```

Windows 路径中的反斜杠需要转义：

```json
{
    "riddle.server.path": "C:\\tools\\riddle\\riddle-lsp.exe"
}
```

修改服务器路径或参数后，执行 **Developer: Reload Window** 重新启动扩展。

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
                "arguments": []
            }
        }
    }
}
```

修改配置后，在命令面板运行 **language server: restart**。Zed 和 Helix 当前复用 Rust Tree-sitter grammar 作为结构化回退；Riddle 专用的标识符分类由 `riddle-lsp` 语义 Token 提供。

## 当前能力

| 能力 | 状态 |
|------|------|
| `.rid` 文件识别 | Helix、VS Code、Zed 均支持 |
| Clue 项目、未保存文件和未打开模块诊断 | 支持 |
| 解析、类型、move/borrow 诊断 | 支持 |
| 函数、类型、参数和可变绑定语义高亮 | 支持 |
| 补全、Hover、跳转定义、查找引用 | 尚未实现 |
| 重命名、格式化、Code Action | 尚未实现 |

## 常见问题

### 编辑器提示找不到 riddle-lsp

先在编辑器内置终端运行 `riddle-lsp --version`。如果外部终端可用而编辑器中不可用，请完全退出并重新启动编辑器，让它重新读取 `PATH`；也可以直接配置绝对路径。

### Helix 没有高亮或缩进查询

运行 `hx --health riddle`。如果 queries 显示不可用，检查三个 `.scm` 文件是否位于 Helix 配置目录的 `runtime/queries/riddle` 下。

### Zed 只有基础语法颜色

确认 `languages.Riddle.semantic_tokens` 设置为 `"full"`，然后重启 language server。Zed 默认不会请求完整语义 Token。

### VS Code 有基础高亮但没有诊断

基础高亮由扩展内的 TextMate grammar 提供，不代表 LSP 已启动。检查 `riddle.server.path`，再打开 **Output** 面板查看 `Riddle Language Server` 输出。
