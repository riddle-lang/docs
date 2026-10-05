# Clue 构建器

`clue` 读 `Clue.toml`，展开入口文件里的 `mod name;` 和依赖，把包交给 `riddlec` 生成 C，再调用系统 C 工具链链接出可执行文件或库。`clue --help` 只列出子命令名，除 `clue doc` 外没有帮助文本，所以每个子命令实际接受的参数都写在下面。

## 子命令与 flag

`--offline` 和 `-j/--jobs <N>` 是全局 flag。前者不做网络访问，只用本地缓存；后者取正整数，缺省时先看配置文件里的 `build.jobs`，再缺省时取机器的可用并行度。

| 子命令 | 位置参数 | flag |
| --- | --- | --- |
| `clue init` | `<PATH>` | `--lib`、`--bin`、`--workspace`，三者互斥 |
| `clue new` | `<PATH>` | 同 `clue init` |
| `clue check` | `[PATH]` | `-p/--package <NAME>`、`--workspace`、`--target <TRIPLE>`、`--bin <NAME>`、`--locked`、`--all-features`、`--all-targets`、`--no-default-features`、`--features <a,b>` |
| `clue build` | `[PATH]` | `check` 的全部，另有 `--example <NAME>`、`--release`；`--bin` 与 `--example` 互斥 |
| `clue run` | `[PATH]` | `-p/--package`、`--target`、`--bin`、`--example`、`--release`、`--locked`、`--all-features`、`--no-default-features`、`--features`，`--` 之后全部传给程序 |
| `clue test` | `[PATH]` | `-p/--package`、`--workspace`、`--test <NAME>`、`--no-run`、`--release`、`--locked`、`--all-features`、`--no-default-features`、`--features` |
| `clue bench` | `[PATH]` | `-p/--package`、`--workspace`、`--bench <NAME>`、`--locked`、`--all-features`、`--no-default-features`、`--features`，`--` 之后全部传给程序 |
| `clue add` | `<NAME>` | `--version <REQ>`、`--path`、`--git`、`--branch`、`--tag`、`--rev`、`--registry`、`--package`、`--features`、`--no-default-features`、`--optional`、`--dev`、`--project <DIR>`（默认 `.`） |
| `clue remove` | `<NAME>` | `--dev`、`--project <DIR>`（默认 `.`） |
| `clue fetch` | `[PATH]` | `--locked`、`--dev`、`--features` |
| `clue update` | `[PATH]` | 无 |
| `clue tree` | `[PATH]` | `-e/--edges normal\|features`，默认 `normal` |
| `clue metadata` | `[PATH]` | 无 |
| `clue package` | `[PATH]` | `--list` |
| `clue publish` | `[PATH]` | `--registry <NAME>`、`--dry-run` |
| `clue install` | `[<PACKAGE>[@<REQ>]]` | `--path`、`--git`、`--branch`、`--tag`、`--rev`、`--version <REQ>`、`--registry`（需要给出包名）、`--release` |
| `clue uninstall` | `<NAME>` | `--path <DIR>`，默认 `.` |
| `clue clean` | `[PATH]` | 无 |
| `clue doc` | `[PATH]` | `-p/--package`、`--open`、`--document-private-items`、`--no-std` |

参数上的差异：

- `clue run` 没有 `--workspace`，也没有 `--all-targets`；`check`、`build`、`test`、`bench` 都有 `--workspace`。
- `--all-targets` 只出现在 `check` 和 `build`。
- `clue test` 没有 `--target`、`--all-targets` 和 `-- <args>`；`clue bench` 用不到 `--release`（profile 固定为 Release），也没有 `--target` 和 `--no-run`。
- `clue doc` 的 `-p/--package` 与 `check`、`build` 用同一套包选择：在工作区里给名字就只文档那一个包（文档写到 `<包>/.clue/doc`），名字不属于工作区报 `package ... is not a workspace crate`，单包目录下给 `-p` 照旧报 `--package` 与 `--workspace` 需要工作区根。
- `--features` 用逗号分隔，可以重复给。互斥组合在参数解析阶段被拒绝，退出码 2。

## 退出码

| 情形 | 退出码 |
| --- | --- |
| 成功 | 0 |
| 任意错误 | 1，stderr 以 `Error: <消息>` 输出 |
| clap 参数错误（互斥、缺值、非法 triple） | 2 |
| `clue run` | 子进程的退出码；取不到时为 1 |
| Ctrl+C | 1，消息是 `build cancelled` 或 `operation cancelled` |

## 初始化项目

`clue new <PATH>` 要求目标目录不存在，`clue init <PATH>` 允许目录已经存在。两者都拒绝覆盖已有的 `Clue.toml` 或 `src/*.rid`。不传 `--lib` 时按二进制项目生成：

```text
hello/
  .gitignore
  Clue.toml
  src/main.rid
```

入口内容是 `fun main() {\n}\n`。`--lib` 改为写 `src/lib.rid`，里面是 `add(x: i32, y: i32) -> i32`。`.gitignore` 追加一行 `/.clue`，已有这一行时跳过。`--workspace` 写出只含 `crates` 的虚拟清单，并要求目标文件原本不存在：

```toml
[workspace]
crates = []
```

成功输出 `clue: initialized <path>` 或 `clue: created <path>`。

## Clue.toml

清单由手写解析器读取，字段名和类型都按下面的规则校验。除虚拟工作区根外，`[package]` 是必需的，缺了会报 `missing [package] in <path>`。

### [package]

| 字段 | 类型 | 必填 | 默认 |
| --- | --- | --- | --- |
| `name` | 字符串 | 是 | — |
| `version` | semver 字符串 | 否 | `0.1.0` |
| `entry` | 相对路径 | 否 | 按目标或入口规则推导 |
| `license` | 字符串 | 否 | 无 |
| `description` | 字符串 | 否 | 无 |
| `repository` | 字符串 | 否 | 无 |
| `authors` | 字符串数组 | 否 | 空数组 |
| `publish` | bool 或字符串数组 | 否 | 无（允许发布到任何 registry） |

- `name` 不能为空，不能是 `.` 或 `..`，不能含路径分隔符，否则报 `invalid package name ...`。
- `publish = false` 表示禁止发布；`publish = true` 与缺省表示不限；数组是 registry 白名单，发布到名单外的 registry 会报 `package ... cannot be published to registry ...`。
- `version` 不是合法 semver 时报 `invalid package version ...`；`publish` 的类型不对时报 `package.publish must be a boolean or an array of registry names`。
- 虚拟工作区根只有 `[workspace]`，没有 `[package]`。把它当工作区根加载时，清单里如果还有 `[package]`，会报 `workspace root ... must not contain [package]`。
- 没有 `edition`、`keywords`、`categories`、`readme`、`homepage`、`documentation`、`rust-version`、`include`/`exclude`、`default-run`、`links` 这些 Cargo 字段。

### 入口文件

`[package].entry` 一旦出现就直接作为入口，优先于 `[[bin]].path` 和 `[lib].path`，与目标数量无关。没有 `entry` 时：

1. 有 `[[bin]]` 就用第一个 bin 的 `path`；
2. 否则有 `[lib]` 就用它的 `path`（默认 `src/lib.rid`）；
3. 两者都没有时按包类型寻找。binary 包依次尝试 `src/main.rid`、`src/lib.rid`、`<name>.rid`、`main.rid`；库和过程宏包依次尝试 `src/lib.rid`、`<name>.rid`、`lib.rid`、`src/main.rid`。

解析出的入口文件必须存在，否则报 `entry file ... does not exist`；唯一例外是 binary 包声明了多个 `[[bin]]` 时。连候选都找不到时报 `missing entry file; expected src/main.rid, src/lib.rid, <package>.rid, main.rid, or lib.rid`。

### 目标

| 表 | 自动发现目录 | 必填字段 |
| --- | --- | --- |
| `[[bin]]` | `src/main.rid`、`src/bin/*.rid` | 无 |
| `[lib]` | 无 | 无 |
| `[[test]]` | `tests/*.rid` | `path` |
| `[[example]]` | `examples/*.rid` | `path` |
| `[[bench]]` | `benches/*.rid` | `path` |

四个数组表的名字都是单数。写成单表（而不是数组）报 `<table> must be an array of targets`；`[[test]]`、`[[example]]`、`[[bench]]` 的 `path` 必填，缺了报 `<table>[<index>].path is required`。

`[[bin]]` 的字段：

| 字段 | 类型 | 默认 |
| --- | --- | --- |
| `path` | 相对路径 | `src/main.rid` |
| `name` | 字符串 | 文件 stem；stem 是 `main` 时用包名 |
| `required-features` | 字符串数组 | 空 |

自动发现分两步：`src/main.rid` 存在且没有被显式声明时，追加一个以包名命名的 bin；再扫描 `src/bin/*.rid`，文件 stem 就是 bin 名。名字重复报 `duplicate binary target name ...`。

`[lib]` 的字段：

| 字段 | 类型 | 默认 |
| --- | --- | --- |
| `name` | 字符串 | 包名把 `-` 换成 `_` |
| `path` | 相对路径 | `src/lib.rid` |
| `proc-macro` | bool | `false` |
| `crate-type` | 字符串数组 | `["riddlelib"]` |

`crate-type` 只接受 `riddlelib`、`staticlib`、`cdylib`，其它值报 `unsupported library crate type ...`，重复值会去重。`[[test]]`、`[[example]]`、`[[bench]]` 的其余字段是 `name`（默认文件 stem）和 `required-features`；同名目标报 `duplicate <table> target name ...`。

被依赖的包必须声明 `[lib]`。一个只有 `[[bin]]` 的包被别人依赖时，加载会报 `library dependencies must declare a [lib] target`。

### [dependencies] 与 [dev-dependencies]

一个依赖可以写成版本字符串简写，也可以写成表：

```toml
[dependencies]
math = { path = "../math", version = "^1.0" }
json = "^1.2"
codec = { git = "https://example.com/codec.git", tag = "v1.0.0" }
log = { version = "^1", optional = true, default-features = false }

[dev-dependencies]
assertions = { path = "../assertions" }
```

其它类型报 `dependency <alias> must be a version string or table`。表字段：

| 字段 | 类型 | 默认 |
| --- | --- | --- |
| `package` | 字符串 | 与依赖键相同，用于重命名依赖 |
| `version` | semver 约束 | 无 |
| `path` | 相对路径 | — |
| `git` | URL | — |
| `branch` / `tag` / `rev` | 字符串 | 默认分支 |
| `registry` | 字符串 | 默认 registry |
| `optional` | bool | `false` |
| `features` | 字符串数组 | 空 |
| `default-features` | bool | `true` |

- `path` 与 `git` 同时给出报 `dependency <alias> cannot specify both path and git`；`branch`、`tag`、`rev` 给多于一个报 `dependency <alias> may specify only one of branch, tag, or rev`。
- 版本约束非法报 `invalid version requirement ... for dependency ...`。
- 依赖键会成为当前包里的模块名，必须是合法模块名（`[_A-Za-z][_0-9A-Za-z]*`），否则报 `dependency name ... must be a valid module name`。
- 依赖源码以 `mod <alias> { ... }` 内联进当前包。依赖清单里的包名与声明的 `package` 不符时报 `dependency ... expected package ..., found ...`；版本不满足时报 `dependency ... requires version ..., found ...`。
- `[dev-dependencies]` 只在 test、example、bench 目标里加载；`optional` 依赖只在对应 feature 启用时加载。
- git 依赖和 `clue install --git` 需要 PATH 里有 `git`，git 失败时它的 stderr 会原样出现在错误里。
- 工作区内的 path 依赖必须在 `workspace.crates` 中注册，否则报 `path dependency ... at ... is not registered in workspace ...`；工作区之外的 path 依赖不受这条限制。

### [features]

```toml
[features]
default = ["std"]
std = []
extras = ["dep:codec", "codec/fast", "log?/verbose"]
```

- 每个 feature 写成 `name = ["项"]`。值不是数组报 `features.<name> must be an array`，元素不是字符串报 `features.<name> entries must be strings`。
- feature 名只能用 `_`、`-` 和 ASCII 字母数字，首字符是字母数字或 `_`，否则报 `invalid feature name ...`。
- 可选依赖自动获得一个同名 feature 槽位。
- `dep:<name>` 启用可选依赖；`<name>/<feature>` 启用该依赖并转发 feature；`<name>?/<feature>` 只在依赖已经被别的路径启用时才转发。
- 未声明的名字报 `unknown feature ...`，未知依赖的 feature 报 `unknown dependency feature ...`。
- `--features a,b` 按上面的规则逐步展开；`--all-features` 把 `[features]` 里的所有 key 当作请求；`--no-default-features` 只是不再自动加入 `default`，清单里没有 `default` 时本来也不会加。

### [workspace]

```toml
[workspace]
crates = ["hello", "libs/*"]
```

唯一字段是 `crates`：相对路径数组，`*` 可以通配一个路径分量。缺失报 `missing workspace.crates`，类型不对报 `workspace.crates must be an array of paths`，元素不是字符串报 `workspace.crates[<index>] must be a string path`。

注册时的校验：

| 情形 | 消息 |
| --- | --- |
| 绝对路径 | `workspace crate path ... must be relative` |
| 通配不匹配任何目录 | `workspace crate path ... matched no directories` |
| 工作区根注册自己 | `workspace cannot register itself as a crate` |
| 成员目录没有清单 | `workspace crate ... has no Clue.toml` |
| 同一目录注册两次 | `workspace crate ... is registered more than once` |
| 两个成员同名 | `package name ... is used by both ... and ...` |
| 成员之间成环 | `cyclic package dependency: a -> b -> a` |

工作区只有根目录的一份 `Clue.lock`，成员不单独生成。构建时成员按依赖拓扑分批，批内并行，批间串行。

### [runtime]

只能在二进制包里声明，库或依赖包写了会报 `[runtime] is only supported for binary packages`。

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `gc` | bool | `true` | 是否链接带收集器的运行时 |
| `source` | 相对包根的 C 文件路径 | 无 | 替换内置运行时，文件必须存在 |

- `gc = false` 与 `source` 同时给出报 `runtime.gc = false cannot be combined with runtime.source`。
- `source` 指向不存在的文件报 `runtime source ... does not exist`。
- `gc = false` 时链接的是无收集器运行时，所有权堆值改用 `riddle_alloc` / `riddle_free` 管理，需要延长存活期的引用会被拒绝（E0310）。`source` 则整份替换内置运行时实现。
- 运行时的 ABI、分配器和布局描述符见[引用、借用与逃逸](./references-and-escape.md)与[FFI 与 C 后端](./ffi-and-tooling.md)。

### [build]

| 字段 | 类型 | 默认 |
| --- | --- | --- |
| `target` | 目标 triple | 无 |
| `cache` | bool | `true` |

`target` 是目标选择链上的一环，见下文。`cache = false` 关闭全局库缓存。

### 不存在的表

`[profile]`、`[patch]`、`[replace]`、`[workspace.dependencies]`、`[workspace.package]`、`[lints]`、`[badges]`、`[target.*]` 和清单内的 `[registries]` 都没有实现，解析器里没有对应分支。Release 构建只由 `--release` 决定；registry 配置写在 `$CLUE_HOME/config.toml` 或项目的 `.clue/config.toml`。

## 清单错误与编辑器诊断

`clue` 侧的清单错误没有错误码，全部是文本消息，经 `Error: <消息>` 输出到 stderr，退出码 1。上面各节引用的就是这些消息的原文。

`riddle-lsp` 侧另有一套 `CLUE` 码：

| 码 | 严重性 | 含义 |
| --- | --- | --- |
| `CLUE0001` | error | 项目分析或加载失败，比如缺入口文件、依赖解析失败 |
| `CLUE0002` | error | TOML 语法错误 `invalid TOML: ...` |
| `CLUE0003` | warning | 未知 key |
| `CLUE0004` | error | 类型错误、依赖规则冲突、非法 `crate-type` |

这套 schema 是语言服务器手写的白名单，和 `clue` 的解析器是两份独立代码，已知两处偏差：

- `[build].cache` 在 `clue` 里合法，但不在服务器的 `build` key 白名单里，编辑器会报 `unknown key build.cache`（`CLUE0003` 警告）。这是误报，构建行为以 `clue` 为准。
- 服务器的 `[package]` 白名单只有 `name`、`version`、`license`、`entry`、`publish`，所以合法的 `description`、`authors`、`repository` 也会被标成未知 key。

## 构建与产物

`clue check` 只做检查，不生成 C；每个被检查的 bin 打印一行 `clue: checked <入口路径>`，有诊断时以 `check failed` 结束。没有 `--bin` 时逐个检查 `required-features` 已满足的 bin，全部被过滤掉时报 `no binary target has its required features enabled: ...`。`--all-targets` 额外检查 test、example、bench 三类目标，未满足 `required-features` 的目标静默跳过。

`clue build` 生成 C 并链接。`--release` 只切换 `BuildProfile`，不读清单里的 profile 表；`--all-targets` 构建 test、example、bench，但只编译不运行。构建目录里的产物：

| 文件 | 说明 |
| --- | --- |
| `<target>.c` | 生成的 C 源码 |
| `<target>.runtime.c` | 内置运行时的副本；`[runtime].source` 时不生成 |
| `<target>.args.c` | 进程参数运行时 |
| `<target>.hash` | 16 位十六进制指纹 |
| `<target>[.exe]` | 可执行文件 |
| `<target>.o` / `.obj` | 库的目标文件 |
| `<target>.rmeta` | JSON 元数据（schema 1、name、version、target、source_hash） |
| `<target>.rlib` | `riddlelib` 产物 |
| `lib<name>.a` / `<name>.lib` | `staticlib` 产物 |
| `lib<name>.so` / `.dylib` / `<name>.dll` | `cdylib` 产物 |
| `.cc-<identity>` | C 编译器探测结果缓存 |

目录规则不对称：宿主 debug 构建直接用 `<包根>/.clue/build`；release 构建和任何显式目标用 `<包根>/.clue/build/<triple>/<profile>`，profile 取 `debug` 或 `release`。每个构建目录里有一个 `.build-lock`，同一包的并发构建会串行化。所有写盘都是先写临时文件再原子替换。Clue 没有 `target/` 目录。

构建成功时的输出是 `clue: built <exe>`、`clue: fresh <exe>`、`clue: built library <name>`、`clue: fresh library <name>` 或 `clue: cached library <name>`。

## 缓存

指纹由清单内容、展开后的源码、运行时源码、进程参数运行时代码、字面量 `c11`、`riddlec` 的 git hash、目标 triple 和 C 编译器的程序名、flavor、版本一起算出。`.c`、`.args.c`、运行时文件都存在且 `.hash` 内容匹配时才算新鲜，否则重新生成。换 `riddlec` 或换 C 编译器都会让整个缓存失效。二进制还要额外确认可执行文件和依赖归档仍在。

库构建会把产物发布到全局缓存，路径是 `$CLUE_HOME/cache/build/<triple>/<profile>/<fingerprint>/`。指纹相同、依赖产物齐全时直接从缓存恢复，打印 `clue: cached library <name>`；二进制不走这个缓存。发布失败不影响构建结果。关闭方式有 `[build] cache = false` 和 `CLUE_BUILD_CACHE=0`（只有字面 `0` 生效）。

`clue clean` 删除 `<包根>/.clue/build`；工作区里会对根和每个成员各删一次。它不动 `$CLUE_HOME` 下的全局缓存。

## Clue.lock

单包项目在项目根目录维护 `Clue.lock`，工作区只在根目录维护一份。文件顶层是 `version`（当前 3）和 `[[package]]` 数组：

| 字段 | 说明 |
| --- | --- |
| `name`、`version` | 包名与版本，`version` 是字符串 |
| `source` | `""`（根或 path）、`path+<绝对路径>`、`registry+<索引>`、`git+<url>#<rev>` |
| `path` | 相对工作区根（单包时相对项目根）的路径 |
| `dependencies` | 依赖名数组，为空时不写出 |
| `source_hash` | 源码指纹 |
| `checksum` | registry 包的校验和，为空时不写出 |
| `features` | 启用的 feature，为空时不写出 |

`source_hash` 递归收集包里的 `*.rid` 和 `Clue.toml`，跳过 `.clue`、`.git`、`target` 和 `Clue.lock*`，按相对路径排序后哈希，输出 16 位十六进制。改非源码文件不会动锁文件。

- `--locked` 要求锁文件已存在且与本次求解结果完全相等，否则报 `missing <path>; run without --locked once` 或 `<path> is out of date; run without --locked to update it`。
- 不加 `--locked` 时，内容没变就不碰文件，变了才用临时文件加原子替换写回。
- 锁文件用 `<包根>/.clue/lock-guard` 做进程间互斥，不是项目根目录下的 `Clue.lock.guard`。
- `clue tree` 和 `clue metadata` 会先解析依赖，需要锁文件存在，缺了报 `missing <path>`；`clue package` 和 `clue package --list` 不解析依赖，也不触发 fetch。

## 依赖获取、打包与发布

- `clue fetch` 解析依赖并写锁文件，打印 `clue: fetched dependencies`。
- `clue update` 忽略已有锁定结果重新求解。
- `clue tree` 从锁文件打印依赖树，节点形如 `name version [features: a,b]`；`-e features` 显示 feature，`-e normal`（默认）不显示。
- `clue metadata` 输出 JSON，包含 `manifest`（name、version、description、authors、repository、license、publish）和 `lock`。
- `clue package` 生成 `.clue/package/<name>-<version>.cluepkg`（tar.gz），打包时排除 `.git` 和 `.clue`，遇到符号链接报 `package contains symbolic link ...`；`--list` 只打印将打包的相对路径。
- `clue publish --dry-run` 只打包并按 `publish` 白名单校验，不联网；真实发布向 `{api}/v1/crates/new` 发 multipart 请求，用 Bearer token 鉴权。
- `clue install` 不带来源参数时安装当前目录的包；`name@<需求>` 不能与 `--version` 同时给；库包不能安装（`cannot install a library package`）。装好的可执行文件放在 `$CLUE_HOME/bin`，`clue uninstall <NAME>` 从这里删除。
- registry 包下载后会校验 SHA-256，并按安全路径规则解包。

依赖来源有 path、git 和 sparse registry 三种。`clue add` 与 `clue remove` 用 toml_edit 原地修改清单，保留无关的排版，成功后打印 `clue: added <name>` / `clue: removed <name>`。

## 全局目录与配置

`CLUE_HOME` 的解析顺序是 `$CLUE_HOME`、`$USERPROFILE/.clue`、`$HOME/.clue`；都没有时报 `cannot determine Clue home; set CLUE_HOME`。

| 路径 | 用途 |
| --- | --- |
| `$CLUE_HOME/config.toml` | 全局配置 |
| `<项目>/.clue/config.toml` | 项目配置，覆盖全局 |
| `$CLUE_HOME/registry/src/<hash16(index)>/<name>-<version>` | 解包后的 registry 包 |
| `$CLUE_HOME/git/db/<hash16(url)>` | git 裸库 |
| `$CLUE_HOME/git/checkouts/<hash16(url)>/<revision>` | git 检出 |
| `$CLUE_HOME/bin` | `clue install` 的目标目录 |
| `$CLUE_HOME/cache/build/...` | 全局库缓存 |

配置文件的表：

```toml
[net]
offline = false

[build]
jobs = 8

[registry]
default = "default"

[registries.default]
index = "https://registry.riddle-lang.org/index"
api = "https://registry.riddle-lang.org"
token = "..."
```

`build.jobs` 必须是正数，否则报 `build.jobs in ... must be positive`。默认 registry 名是 `default`，默认索引是 `https://registry.riddle-lang.org/index`。

环境变量：

| 变量 | 作用 |
| --- | --- |
| `CLUE_HOME` | 全局目录 |
| `CLUE_OFFLINE` | 强制离线，接受 `1/true/yes` 或 `0/false/no`，其它值报 `CLUE_OFFLINE must be true or false` |
| `CLUE_JOBS` | 并行度，必须是正整数 |
| `CLUE_REGISTRY_INDEX` / `CLUE_REGISTRY_TOKEN` | 覆盖默认 registry 的索引和令牌 |
| `CLUE_BUILD_CACHE` | 取 `0` 时关闭全局库缓存 |
| `RIDDLE_TARGET` | 目标 triple |
| `RIDDLE_TARGET_ROOT` / `RIDUP_TOOLCHAIN_ROOT` | 目标组件的根目录，前者优先 |
| `CC` | 指定 C 编译器，见下文 |

## 目标平台与 C 工具链

目标按 `--target`、`RIDDLE_TARGET`、`[build].target`、宿主的顺序选择，先命中者生效。选中的 triple 同时给出检查 `usize`/`isize` 字面量的宽度，`i686-*` 下 `4294967296usize` 报 `E0011`。`[build].target` 要等包加载完才看得见（加载就发生在分析内部），所以它和宿主宽度不一致时 `clue check`/`clue build` 会按构建目标的宽度再分析一次；宽度一致时只有一次分析。支持的 triple 恰好七个：

- `x86_64-unknown-linux-gnu`
- `aarch64-unknown-linux-gnu`
- `i686-unknown-linux-gnu`
- `x86_64-pc-windows-msvc`
- `i686-pc-windows-msvc`
- `aarch64-pc-windows-msvc`
- `aarch64-apple-darwin`

非宿主目标需要一个已安装的目标组件（`ridup target add <triple>`）。组件目录里的 `target.toml` 声明 `schema = 1`、`triple` 和运行时文件路径；缺组件报 `target component <triple> is not installed; run ridup target add <triple>`。组件还提供可选的 `c-toolchain.toml`，并且：

- Linux 目标缺 sysroot 报 `... is missing a Linux sysroot; run ridup target configure <triple> --sysroot <path>`；
- 非 macOS 宿主构建 macOS 目标缺 SDK 时同理；
- Windows 目标缺 Windows SDK 或 MSVC 路径时报错并给出 `ridup target configure` 的参数。

C 编译器的选择顺序：

1. 设置了 `CC` 就只用它。报不出版本报 `C compiler from CC ... could not report its version`；编译或链接失败报 `C compiler from CC ... cannot compile and link C11`。不会回退到别的编译器。
2. 否则用目标组件 `c-toolchain.toml` 里配置的编译器，失败同样直接报错。
3. 再按平台探测：宿主 Windows 是 `clang-cl`、`clang`、`cc`、`gcc`、`cl`；跨到 Windows 是 `clang`、`cc`、`gcc`、`clang-cl`；其它是 `clang`、`cc`、`gcc`。之后追加 PATH 里带版本号的 `clang-cl-N`、`clang-N`、`gcc-N`，按版本降序。候选必须能编译并链接一个 C11 程序，否则跳过。

全部失败时报 `no usable C11 compiler and linker found; tried <列表>; set CC to a compiler executable`。归档静态库需要 `ar`（Unix flavor）或 `llvm-lib` / `lib`（MSVC flavor）。交叉编译在 clang 下会加 `--target=<triple>` 和 `-fuse-ld=lld`。工具侧路径含非 ASCII 字符时，Clue 会从公共父目录用相对路径调用编译器。

`clue run` 和 `clue test` / `clue bench` 在运行产物时只能在宿主目标上（`clue test --no-run` 只构建，不受这条限制），交叉产物要复制到目标系统执行。工作区里多个成员被选中时，`clue run` 要求 `--package`。`clue run` 的工作目录是包根，程序退出码原样成为 `clue` 的退出码。

## 过程宏

过程宏包声明 `[lib] proc-macro = true`，源码里用 `#[proc_macro]`、`#[proc_macro_attribute]` 或 `#[proc_macro_derive(Name)]` 导出宏函数。

```toml
[package]
name = "answer-macros"

[lib]
path = "src/lib.rid"
proc-macro = true
```

`clue new` 没有 `--proc-macro`，这种清单要手写。宏包编译成宿主平台的动态库加一个 runner，不链进目标程序；每个宏包一个常驻子进程，单次展开最多 10 秒，输入输出各受 16 MiB 限制，宏里的 `print` 走 stderr（stdout 是私有协议通道），宏内 panic 被隔离，不会带崩 `clue`。`syn` 与 `quote!` 在宏宿主里自动注入，不需要在清单里声明依赖。宏函数的签名要求、导入方式和可用工具见[编写过程宏](./proc-macros.md)，语法节点接口见[内置 syn 与 quote!](./syn.md)。

## 生成 API 文档

```bash
clue doc
clue doc --open
clue doc --document-private-items
cd std && clue doc --no-std
```

`clue doc` 先做一次完整检查，只有检查干净时才写文档，否则报 `documentation requires a clean check`。输出固定在 `<PATH>/.clue/doc`，入口是 `index.html`，每个模块一页，页名把模块路径的 `::` 换成 `-`（`std-collections-hash_map.html`），根模块就是 `index.html`。每页有导航栏、条目签名和文档注释正文；正文支持一级标题、`-` 列表和三反引号代码块，其余按段落处理，内容全部做 HTML 转义。默认只收录 `pub` 条目，`--document-private-items` 放开过滤，`--open` 生成后用系统默认程序打开 `index.html`。没有搜索索引、跨包链接和源码视图。

## 作为 Rust 库使用

`clue` 同时是库，公开了项目创建、检查、构建、运行、清理和项目分析的函数：

```rust
use clue::{ProjectKind, build, check, new};
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let root = Path::new("hello");
    new(root, ProjectKind::Binary)?;
    check(root)?;
    build(root)?;
    Ok(())
}
```

`init` 对应 `clue init`（允许目录已存在），`run` 接受 `&[OsString]` 作为程序参数。这个包没有发布到 registry，只能作为仓库内的 path 依赖使用。安装工具链见[安装工具链](./install.md)，项目从零开始的流程见[项目、依赖与构建](./clue-create.md)。
