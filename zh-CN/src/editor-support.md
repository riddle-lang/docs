# 编辑器与 LSP

`riddle-lsp` 是工具链里唯一的语言服务器，仓库为 VS Code、Helix、IntelliJ IDEA 和 Zed 各带一份适配。四份适配的完成度不一样：只有 VS Code 和 Helix 会把 `Clue.toml` 也发给服务器。

## riddle-lsp 的参数与传输

服务器只支持 stdio：启动后从 stdin 读 JSON-RPC，往 stdout 写。没有 TCP、端口或 socket 模式。全部参数就三个：

| flag | 默认 | 作用 |
| --- | --- | --- |
| `--no-std` | 关 | 不加载内置标准库 |
| `--completion-delay-ms <MS>` | `40` | 把窗口内到达的补全请求合并成一次 |
| `--trace-latency` | 关 | 把各阶段耗时打印到 stderr；也可用环境变量 `RIDDLE_LSP_TRACE_LATENCY` |

另有 clap 自带的 `-V/--version` 和 `-h/--help`。没有 `--tcp`、`--port`、`--stdio`、`--log`、`--log-file`、`--clientProcessId` 之类的选项。`serverInfo` 的名字是 `riddle-lsp`，版本串是 crate 版本加编译时的 git hash。

位置编码在 `initialize` 时协商，支持 `utf-16`、`utf-8`、`utf-32`（优先 utf-16）。客户端一个都不提供时，`initialize` 返回 `invalid_params`，消息是 `riddle-lsp needs one of the position encodings utf-16, utf-8 or utf-32; the client offered only: ...`，服务器不会退回错误坐标。

`--no-std` 直接关掉标准库加载，语义高亮、悬停和补全都会失去 std 里的信息，只保留当前缓冲能解析出的部分。

工作区发现会跳过 `.git`、`.clue`、`target`、`node_modules`、`dist`；如果打开的是虚拟工作区根，就只加载 `[workspace].crates` 里的成员。索引在保存和文件事件上重建，`textDocumentSync.save` 是开启的，但没有 `willSave`。

## 服务器实现了什么

| 能力 | 细节 |
| --- | --- |
| 文档同步 | open/close、增量 change、save |
| 诊断 | push 与 pull 都有；`diagnosticProvider` 打开 `interFileDependencies` 与 `workspaceDiagnostics`；`workspace/diagnostic` 覆盖未打开模块与本地依赖 |
| 补全 | `.` 和 `:` 触发；跨文件、自动导入、重名路径区分；`resolveProvider` 为 false |
| 悬停 | 函数签名、推断类型、struct/enum 声明；方法调用显示实例化后的签名 |
| 签名帮助 | `(` 和 `,` 触发，`,` 重新触发，跟踪当前参数 |
| 跳转 | 定义、声明、类型定义、trait 方法实现、调用层级；类型层级的条件见下文 |
| 引用与重命名 | 项目级查找引用；`prepareProvider` 为 true；字段、trait 方法、导入别名都能重命名 |
| 符号 | 文档符号（含 `impl` 块）与工作区符号 |
| 语义高亮 | 全文与区间两种请求，全文带 delta；legend 有 16 种 token type 和 4 种 modifier（declaration、mutable、static、defaultLibrary） |
| Inlay Hint | `let` 绑定推断类型、匿名函数参数类型（已写类型的不提示）、多行链式调用每一级的结果类型、调用实参名 |
| 折叠与选择范围 | 花括号块、连续注释行、连续 `use` 组；结构化选择范围 |
| 文档链接 | `mod foo;`（内联 `mod` 跳过）与 `use` 的首段，链到 `foo.rid` 或 `foo/mod.rid`；两种文件都在时不产生链接，未落盘的缓冲不产生链接 |
| 格式化 | 全文与区间格式化，`tabSize` / `insertSpaces` 由客户端传入 |
| 代码动作 | `quickfix`、`source.organizeImports`、`source.addMissingImports`、`source.fixAll`，`resolveProvider` 为 false |
| Clue.toml | 诊断、节与键补全、键悬停、节符号 |

诊断的 `source` 是 `riddle`（编译器）或 `clue`（清单与项目加载）。带错误码的诊断会附上 `codeDescription`，指向 `https://riddle-lang.github.io/docs/errorcode.html#<小写错误码>`。服务器自己产生的码只有 `LSP0001`：缓冲与编辑器失同步时用它，而不是静默清掉诊断。

`quickfix` 的修复由诊断驱动：

| 触发 | 动作 |
| --- | --- |
| E0031 且消息含 `cannot call a mutable closure through an immutable binding` | 给匿名函数绑定加 `mut` |
| E0031 且消息以 `cannot assign to` 开头 | 给绑定加 `mut` |
| E0046 且消息以 `requires an unsafe block` 结尾 | 包一层 `unsafe` 块 |
| E0007 且消息以 `missing field` 开头 | 插入缺失字段（`todo!()` 占位） |
| E0039 且消息含 `missing pattern` | 补 match 分支或通配分支 |
| E0051 且消息是 `empty use declaration` | 删掉空的 `use` |
| E0056 且消息建议改用 `drop(value)` | 改写成 `drop(...)` |

需要分析的修复有 E0050 的名字纠错与自动导入、E0013 的方法名纠错、E0026 的 trait 方法 stub。`source.organizeImports` 排序、去重并删除空 `use`；`source.addMissingImports` 只合并自动导入类编辑；`source.fixAll` 收集附加编辑并避开重叠。

调用层级只包含编译器能静态解析的目标，不推测函数指针、匿名函数或 trait 的运行时分派。类型层级不在静态 capabilities 里（当前依赖的 `lsp-types` 没有这个字段），只有客户端声明支持动态注册时，服务器才在 `initialized` 阶段注册 `textDocument/prepareTypeHierarchy`；客户端不支持动态注册时这项功能不可见。文件重命名监听只广告 `**/*.rid` 且 `kind = File`。

几个容易被忽略的限制：`codeActionProvider`、`completionProvider`、`documentLinkProvider` 的 `resolveProvider` 都是 false；单文档场景（未纳入 Clue 项目的文件）走独立的检查会话，语义高亮、Inlay Hint 和代码动作不保证跨包；不可重命名的目标返回 `invalid_params`（例如 `there is nothing to rename at this position`、`this item is not defined in the project and cannot be renamed`），而不是空结果。

## 编辑器支持矩阵

| 项目 | VS Code | Helix | IntelliJ IDEA | Zed |
| --- | --- | --- | --- | --- |
| 适配形式 | JavaScript 扩展 | `languages.toml` 加查询文件 | Kotlin 插件 | WASM 扩展 |
| `.rid` 识别 | 语言 id `riddle`，扩展名 `.rid` | `file-types` 里的 `{ glob = "*.rid" }` | 文件类型 `Riddle`，扩展名 `rid` | `path_suffixes = ["rid"]` |
| 基础高亮 | 自带 TextMate 语法 | Rust Tree-sitter grammar 加 `highlights.scm` | 无 | Rust Tree-sitter grammar 加 `highlights.scm` |
| `Clue.toml` 路由 | 有，独立 `clue` 语言 id | 有，按文件名 glob | 无 | 无 |
| 适配层的 Inlay Hint 开关 | `riddle.inlayHints.enabled` | 无 | 无 | 无 |
| 服务器路径 | `riddle.server.path` 与 `riddle.server.arguments` | `languages.toml` 的 `command` 与 `args` | 无，硬编码 `riddle-lsp` | `lsp.riddle-lsp.binary` 的 `path` 与 `arguments` |
| 打包产物 | `riddle-vscode.vsix` | `riddle-helix.zip` | `riddle-intellij.zip` | `riddle-zed.zip` |
| 安装方式 | `code --install-extension` | 合并到 Helix 配置目录 | Install Plugin from Disk | Dev Extension |

默认情况下四份适配都从 `PATH` 找 `riddle-lsp`。VS Code、Helix、Zed 可以改成显式路径，IntelliJ 只能依赖 `PATH`；Zed 的扩展在设置和工作树的 `PATH` 里都找不到时报 `riddle-lsp was not found on PATH`。

## VS Code

扩展的 `documentSelector` 同时匹配 `riddle` 和 `clue` 两种语言，所以 `.rid` 与 `Clue.toml` 共用同一个服务器实例。激活事件是 `onLanguage:riddle`、`onLanguage:clue` 和 `workspaceContains:**/Clue.toml`。

TextMate 语法（`source.riddle`）只覆盖 `.rid`；`Clue.toml` 靠 VS Code 内建的 TOML 高亮显示，语义信息来自服务器。扩展还注册了一个名为 `riddle` 的图标主题。

| 配置项 | 类型 | 默认 | 作用 |
| --- | --- | --- | --- |
| `riddle.server.path` | string | `riddle-lsp` | 服务器可执行文件路径 |
| `riddle.server.arguments` | string[] | 空 | 传给服务器的参数 |
| `riddle.inlayHints.enabled` | boolean | `true` | Inlay Hint 总开关 |
| `riddle.trace.server` | `off` / `messages` / `verbose` | `off` | VS Code 与服务器之间的 JSON-RPC 跟踪 |

`riddle.inlayHints.enabled` 是扩展自己实现的：关掉后中间件直接返回空数组，其余能力不受影响。

构建扩展需要 npm：`npm run build` 先生成图标，再用 esbuild 把 `extension.js` 打成 `dist/extension.js`；产出 vsix 的是 `vsce package`（打包脚本按 `npm ci`、`npm run check`、`vsce package` 的顺序执行）。安装用 `code --install-extension riddle-vscode.vsix`，也可以在扩展面板的 `...` 菜单里选 **Install from VSIX...**。扩展的 README 示例里写的是旧版本号，实际文件名以打包输出为准。仓库里没有发布到 Marketplace 的配置，release 流程只把 vsix 作为发布资产上传。

## Helix

`languages.toml` 注册一个服务器和一个语言：

```toml
[language-server.riddle-lsp]
command = "riddle-lsp"

[[language]]
name = "riddle"
scope = "source.riddle"
language-id = "riddle"
file-types = [
    { glob = "*.rid" },
    { glob = "Clue.toml" },
]
roots = ["Clue.toml", ".git"]
comment-tokens = "//"
indent = { tab-width = 4, unit = "    " }
grammar = "rust"
language-servers = ["riddle-lsp"]
```

`Clue.toml` 由同一个 `riddle` 条目按文件名匹配，所以清单的诊断、补全和悬停也来自这个服务器。查询文件有三个：`runtime/queries/riddle/highlights.scm`、`indents.scm`、`textobjects.scm`。

仓库里没有 Helix 的安装说明。按 Helix 的通用做法：把上面的两个配置块合并进 Helix 配置目录的 `languages.toml`（已有文件时不要整个覆盖），把 `runtime/queries/riddle` 复制到配置目录的 `runtime/queries/riddle`，然后重启 Helix。Linux / macOS 的配置目录是 `~/.config/helix`，Windows 是 `%AppData%\helix`。安装后可以用 `hx --health riddle` 检查语言服务器和三类查询是否都被找到。

需要指定服务器路径或参数时改 `[language-server.riddle-lsp]`：

```toml
[language-server.riddle-lsp]
command = "/path/to/riddle-lsp"
args = ["--completion-delay-ms", "25"]
```

Helix 的 `grammar = "rust"` 意味着 Tree-sitter 按 Rust 语法近似处理结构；Riddle 专有的标识符分类来自服务器的语义高亮。

## IntelliJ IDEA

插件 id 是 `org.riddlelang.intellij`，依赖 `com.intellij.modules.platform` 和 `com.intellij.modules.lsp`。它注册文件类型 `Riddle`（扩展名 `rid`），并通过平台自带的 LSP API 启动服务器。启动命令硬编码为 `riddle-lsp`，从 IDE 进程的 `PATH` 里查找，插件没有提供任何配置项，也不传额外参数；改完系统 `PATH` 要完全退出并重启 IDE。

插件没有贡献 TextMate 或 Tree-sitter 语法，语义高亮完全来自服务器；服务器没起来时 `.rid` 文件没有任何 Riddle 高亮。它也不支持 `Clue.toml`，清单文件仍按普通文件处理。

目标平台是 IntelliJ Platform 2026.1 及以上，不支持 Android Studio；构建需要 JDK 25 或更高版本作为 Gradle JVM。只构建插件时：

```powershell
Set-Location editors\intellij
.\gradlew.bat buildPlugin
```

产物在 `build/distributions/riddle-intellij-<version>.zip`。安装走 **Settings | Plugins | Install Plugin from Disk...**，选择 ZIP 后重启 IDE。仓库里没有发布到 Marketplace 的配置。

## Zed

扩展声明一个语言服务器 `riddle-lsp`，语言名 `Riddle`，`schema_version = 1`。语言配置里 `grammar = "rust"`、`path_suffixes = ["rid"]`、`line_comments = ["// "]`、`tab_size = 4`、`hard_tabs = false`，并带括号自动闭合；高亮查询在 `languages/riddle/highlights.scm`。

扩展本体是 WASM（`zed_extension_api` 0.1.0），启动服务器时先读工作树的 `lsp.riddle-lsp.binary` 设置，没有再退回 `which("riddle-lsp")`：

```json
{
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

基础颜色来自 Rust Tree-sitter grammar；服务器的语义高亮需要显式开启：

```json
{
    "languages": {
        "Riddle": {
            "semantic_tokens": "full"
        }
    }
}
```

Zed 不支持 `Clue.toml`：`zed_extension_api` 0.1.0 无法为一个服务器声明第二种语言。

仓库里没有 Zed 的安装说明。扩展目录顶层有 `extension.toml`，可以按 Zed 的 Dev Extension 流程从解压目录（或仓库里的 `editors/zed`）加载。打包产物 `riddle-zed.zip` 里是 `Cargo.lock`、`Cargo.toml`、`extension.toml`、`languages` 和 `src`。

## Clue.toml 的 schema 偏差

服务器侧的清单 schema 是一份手写白名单，覆盖 `package`、`dependencies`、`dev-dependencies`、`features`、`bin`、`lib`、`test`、`example`、`bench`、`workspace`、`runtime`、`build` 十二个节，和 `clue` 的解析器不共享代码。已知两处不一致：

- `[build].cache` 在 `clue` 里是合法字段，但服务器的 `build` 白名单只有 `target`，编辑器会报 `unknown key build.cache`（`CLUE0003` 警告）。这是误报。
- `[package]` 的白名单只有 `name`、`version`、`license`、`entry`、`publish`，所以合法的 `description`、`authors`、`repository` 也会被标成未知键（`unknown key package.description` 之类）。

清单里的字段、默认值和消息以 [Clue 构建器](./clue.md) 为准。

## 打包

`editors/package.sh`（Bash，需要 `zip`）和 `editors/package.ps1`（PowerShell）都在 `editors/dist` 下产出四个文件：`riddle-vscode.vsix`、`riddle-intellij.zip`、`riddle-helix.zip`、`riddle-zed.zip`。

- VS Code：`npm ci`、`npm run check`（语法检查加图标生成和 esbuild 打包），再用 `vsce package`。
- IntelliJ：`gradlew buildPlugin`，脚本取 `build/distributions` 里最新的 `riddle-intellij-*.zip` 复制成 `riddle-intellij.zip`。
- Helix：把 `languages.toml` 和 `runtime` 压成 zip。
- Zed：把 `Cargo.lock`、`Cargo.toml`、`extension.toml`、`languages`、`src` 压成 zip。

打 VS Code 包需要 Node.js 与 npm（`npm ci`、esbuild、vsce），打 IntelliJ 包需要 JDK 25 或更高版本，首次构建时 Gradle 会下载 IntelliJ Platform SDK；Helix 和 Zed 的产物只是把现成文件压缩。

## 常见问题

**编辑器说找不到 `riddle-lsp`。** 先在编辑器内置终端里运行 `riddle-lsp --version`。外部终端可用而编辑器里不可用时，完全退出编辑器再启动，让它重新读取 `PATH`；或者直接配置绝对路径（VS Code 用 `riddle.server.path`，Helix 改 `command`，Zed 用 `lsp.riddle-lsp.binary.path`，IntelliJ 只能修 `PATH`）。

**VS Code 有颜色但没有诊断。** 基础高亮由扩展内的 TextMate 语法提供，和服务器是否启动无关。检查 `riddle.server.path` 与 `riddle.server.arguments`，再打开 **Output** 面板看 `Riddle Language Server` 的输出。

**Helix 没有高亮或缩进。** 运行 `hx --health riddle`，确认语言服务器和三个 `.scm` 都显示可用；不可用时检查它们是否在配置目录的 `runtime/queries/riddle` 下。

**Zed 只有基础语法颜色。** 在 `settings.json` 里把 `languages.Riddle.semantic_tokens` 设为 `"full"`，然后重启 language server。

**IntelliJ 里没有诊断或高亮。** 确认 IDE 是 2026.1 或更高版本，在 IDE 内置终端运行 `riddle-lsp --version`；命令不可用时修好 `PATH` 并完全重启 IDE，仍不行就用 **Help | Show Log** 看 LSP 启动错误。插件本身没有语法回退。

**看得到跳转定义但看不到类型层级。** 类型层级依赖客户端的动态注册能力，客户端不支持时服务器不会注册 `textDocument/prepareTypeHierarchy`，这不是配置问题。

**清单里出现 `unknown key build.cache` 或 `unknown key package.description`。** 这是服务器 schema 的已知偏差，`clue` 接受这些字段，警告可以忽略。
