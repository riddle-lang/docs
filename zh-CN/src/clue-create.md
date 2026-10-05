# 创建与构建项目

## 创建包

```bash
clue new hello             # 目标目录必须不存在
clue init hello            # 目标目录已存在也可以
clue new --lib math        # 库包
clue new demo --workspace  # 虚拟工作区
```

`new` 在目标已存在时直接失败，退出码 1：

```text
Error: destination `hello` already exists
```

`init` 允许写进已有目录，但不会覆盖已有文件；目录里已经有 `Clue.toml`，或者已经有该类型对应的入口源码（二进制包是 `src/main.rid`，库包是 `src/lib.rid`）时报：

```text
Error: refusing to overwrite files in `<目录绝对路径>`
```

`--lib` 与 `--bin` 互斥，两个都不写时默认二进制包。二进制包生成：

```toml
[package]
name = "hello"
version = "0.1.0"

[[bin]]
name = "hello"
path = "src/main.rid"

[dependencies]
```

库包把 `[[bin]]` 换成 `[lib]`，入口是 `src/lib.rid`，初始内容带一个示例函数：

```toml
[lib]
name = "math"
path = "src/lib.rid"
```

```riddle
pub fun add(x: i32, y: i32) -> i32 {
    x + y
}
```

`--workspace` 只写一份清单，不生成源码：

```toml
[workspace]
crates = []
```

二进制包和库包的 `new`、`init` 都会往目标目录的 `.gitignore` 追加 `/.clue`；文件里已经有 `.clue`（`/.clue`、`.clue/` 等写法都算）时跳过。`--workspace` 只写清单，不生成 `.gitignore`；它自己的 `init` 在已有 `Clue.toml` 时以 `refusing to overwrite ...` 失败，消息里带清单的绝对路径。

## 入口与构建目标

`[[bin]]` 和 `[lib]` 省略字段时取默认值：

| 目标 | 字段 | 默认值 |
| --- | --- | --- |
| `[[bin]]` | `name` | 文件名的 stem；文件叫 `main.rid` 时用包名 |
| | `path` | `src/main.rid` |
| | `required-features` | 空 |
| `[lib]` | `name` | 包名把 `-` 换成 `_` |
| | `path` | `src/lib.rid` |
| | `proc-macro` | `false` |
| | `crate-type` | `riddlelib`；还可选 `staticlib`、`cdylib` |

除了显式声明，Clue 还会自动发现两类 bin：`src/main.rid` 存在且尚未被声明时追加一个以包名命名的 bin；`src/bin/*.rid` 每个文件追加一个 bin，名字取文件 stem。多个 bin 时 `clue check` 和 `clue build` 都处理全部，`clue run` 必须指明哪一个：

```text
> clue run
Error: package `binproj` has multiple binary targets; choose one with `--bin <name>`
```

一个目标都推导不出来时，入口文件按包类型依次查找：

- 二进制包：`src/main.rid`、`src/lib.rid`、`<包名>.rid`、`main.rid`；
- 库与过程宏包：`src/lib.rid`、`<包名>.rid`、`lib.rid`、`src/main.rid`。

全部落空时报：

```text
Error: missing entry file; expected src/main.rid, src/lib.rid, <package>.rid, main.rid, or lib.rid
```

`[package].entry` 可以直接写死入口的相对路径，设置后不再走上面的推导。`[[test]]`、`[[example]]`、`[[bench]]` 的 `path` 必须显式给出，对应的自动发现目录是 `tests/`、`examples/`、`benches/`；表名都是单数。

## 模块文件

不带花括号的 `mod name;` 会去读文件，位置相对当前模块所在目录：先找 `name.rid`，再找 `name/mod.rid`。两个文件都在、或者两个都不在，构建都会停下来：

```text
module `foo` is ambiguous; both `<目录>/foo.rid` and `<目录>/foo/mod.rid` exist
module `foo` not found; expected `<目录>/foo.rid` or `<目录>/foo/mod.rid`
```

进入 `name` 模块后，它的子模块从 `name/` 目录下继续找。只有被 `mod` 声明的文件才进入编译：`src/util/mod.rid` 存在但源码里没写 `mod util;` 时，这个文件完全不参与构建。

```text
src/
  main.rid           mod util;         → src/util.rid 或 src/util/mod.rid
  util/
    mod.rid          mod text;         → src/util/text.rid
    text.rid
```

带花括号的 `mod name { ... }` 是内联写法，不读文件：

```riddle
mod util {
    pub fun double(value: i32) -> i32 {
        value * 2
    }
}

fun main() {
    println!("{}", util::double(21));
}
```

## 依赖

`[dependencies]` 里的每个键既是包名，也是注入当前包的模块名。三种来源：

```toml
[dependencies]
math = { path = "../math" }
codec = { git = "https://example.com/codec.git", tag = "v1.0.0" }
json = "^1.2"
internal = { version = "^0.4", registry = "company" }
```

字符串简写等价于只写 `version` 的 registry 依赖。表格式支持的字段：

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `package` | string | 同键名 | 键名与真实包名不一致时用它 |
| `version` | semver 需求 | 无 | 本地依赖版本不满足时报错 |
| `path` | string | — | 相对当前包根 |
| `git` | URL | — | 需要系统里有 `git` |
| `branch` / `tag` / `rev` | string | 默认分支 | 三者最多写一个，且必须与 `git` 同时出现 |
| `registry` | string | `default` | |
| `optional` | bool | `false` | 只有同名 feature 被启用才加载 |
| `features` | string 数组 | 空 | 转发给依赖的 feature |
| `default-features` | bool | `true` | 为 `false` 时不自动排队依赖的 `default` |

`path` 和 `git` 同时写、`branch`/`tag`/`rev` 写多个，都会在解析清单阶段失败。键名必须是合法模块名（`[_A-Za-z][_0-9A-Za-z]*`）。解析和加载阶段的几种典型报错：

```text
dependency `a` cannot specify both `path` and `git`
dependency `a` may specify only one of `branch`, `tag`, or `rev`
dependency name `1bad` must be a valid module name
dependency `m` requires version `^1.0`, found `0.9.0`
dependency `m` expected package `math-core`, found `math`
```

依赖源码以 `mod <键名> { ... }` 的形式内联进当前包，所以调用直接写模块路径：

```text
fun main() {
    println!("{}", math::one());
}
```

依赖包里要被外部使用的项必须声明 `pub`：

```riddle
pub fun one() -> i32 {
    1
}
```

`[dev-dependencies]` 的表结构和字段完全相同，只在构建 test、example、bench 目标时加载。可选依赖会自动获得同名 feature 槽位，`[features]` 里可以写三种转发：

```toml
[features]
default = ["json"]
json = ["dep:json"]
extras = ["codec/tracing"]
```

`dep:json` 启用可选依赖，`codec/tracing` 启用依赖 `codec` 并转发它的 `tracing` feature，`codec?/tracing` 只在 `codec` 已被别的路径启用时才生效。

## 工作区

工作区根只有 `[workspace]`，成员各自保留完整的 `[package]`、目标和依赖：

```toml
[workspace]
crates = ["hello", "math", "crates/*"]
```

`crates` 元素是相对根目录的路径，可以用 `*` 通配一个路径分量。几条校验规则：

- 绝对路径、匹配不到任何目录、把工作区根自己注册进来、同一个成员注册两次，都直接报错；
- 每个成员目录必须有 `Clue.toml`，成员之间不能重名；
- 工作区内部的 path 依赖必须同时出现在 `crates` 里，否则报错说明该依赖没有注册进工作区（`path dependency ... is not registered in workspace ...`）；工作区之外的 path 依赖不受这条限制；
- 依赖成环时报 `cyclic package dependency: a -> b -> a`。

在根目录执行命令会按依赖顺序处理全部成员；在成员目录里直接执行则只处理当前成员。三种选择方式：

```bash
clue check                 # 根目录：全部成员；成员目录：当前成员
clue check --workspace     # 忽略当前目录，处理全部成员
clue check -p math         # 只处理 math
```

`--package` 和 `--workspace` 只在工作区里有效，单包项目里给任一个都报 `--package and --workspace require a workspace root`；在工作区的成员目录里也能用，两种情况都会回到工作区根求解。`clue run` 没有 `--workspace`，工作区选中多个成员时报 `workspace run requires --package when multiple crates are selected`，所以要写成 `clue run -p hello`。

工作区只在根目录维护一份 `Clue.lock`，成员目录里不生成锁文件。

## Clue.lock

锁文件版本是 3，顶层是 `version` 和重复的 `[[package]]`。一个两成员工作区的内容形如：

```toml
version = 3

[[package]]
name = "hello"
version = "0.1.0"
source = 'path+<hello 的绝对路径>'
path = "hello"
dependencies = ["math"]
source_hash = "fb4bf286efe87e99"

[[package]]
name = "math"
version = "0.1.0"
source = 'path+<math 的绝对路径>'
path = "math"
source_hash = "24ce9170a1394d28"
```

- `path` 是包相对工作区根的路径；单包项目里根包写 `"."`。
- `source` 记录来源：本地包是 `path+<绝对路径>`，registry 包是 `registry+<index 地址>`，git 包是 `git+<url>#<revision>`。
- `source_hash` 是 16 位十六进制指纹，只覆盖包内的 `*.rid` 和 `Clue.toml`，跳过 `.clue`、`.git`、`target` 与锁文件本身，因此改 README 之类的文件不会让锁失效。
- `dependencies` 列出直接依赖的包名，`checksum` 记录 registry 包的校验和，`features` 记录启用的 feature；这些字段为空时不会写出来。

写锁是幂等的：求值结果与现有内容一致时不碰文件，否则临时文件加原子替换。跨进程互斥用的是 `<包根>/.clue/lock-guard`，不是项目根目录下的 `Clue.lock.guard`。

`--locked` 要求锁文件存在且与本次求解结果完全一致，否则退出码 1：

```text
Error: missing `<项目>/Clue.lock`; run without --locked once
Error: `<项目>/Clue.lock` is out of date; run without --locked to update it
```

`clue fetch` 解析依赖并写锁文件（`clue: fetched dependencies`），普通构建复用锁定版本，`clue update` 重新求解（`clue: updated dependencies`）。`clue tree` 和 `clue metadata` 要求锁文件已经存在。`--offline` 是全局 flag，只允许使用本地已有内容；等价的开关是环境变量 `CLUE_OFFLINE=1` 和配置文件里的 `[net] offline = true`。

## 构建产物

宿主上不加 `--release` 的构建落在包的 `.clue/build`；`--release` 或目标不等于宿主时，落在 `.clue/build/<triple>/<profile>`，profile 是 `debug` 或 `release`：

```text
.clue/build/hello.c                    # 生成的 C
.clue/build/hello.exe                  # 宿主 debug 可执行文件
.clue/build/<triple>/release/hello.exe   # --release 或目标不是宿主
```

判据是「profile 是 debug 且目标等于宿主」——所以 `clue build --target <宿主 triple>` 在 debug 下仍然写进 `.clue/build`，并不会多出一层目录。每个构建目录里有一个 `.build-lock` 文件锁，同一包的并发构建会被串行化。

目标名 `<target>` 指 bin 或 lib 的名字，同名产物放在一起：

| 产物 | 文件名 |
| --- | --- |
| 生成的 C | `<target>.c` |
| 内置 runtime | `<target>.runtime.c`（`[runtime].source` 存在时不生成） |
| 参数 runtime | `<target>.args.c` |
| 指纹 | `<target>.hash` |
| 可执行文件 | `<target>`，Windows 是 `<target>.exe` |
| 目标文件 | `<target>.o`，MSVC flavor 是 `<target>.obj` |
| 元数据 | `<target>.rmeta` |
| riddlelib | `<target>.rlib` |
| staticlib | `lib<name>.a`，Windows 是 `<name>.lib` |
| cdylib | `lib<name>.so` / `lib<name>.dylib` / `<name>.dll` |

构建消息区分新建和复用：

```text
clue: built <可执行文件绝对路径>
clue: fresh <可执行文件绝对路径>
clue: built library `math`
clue: cached library `math`
```

指纹包含清单、源码、runtime 文本、目标 triple 和 C 编译器的身份。源码文本参与指纹，改注释同样会触发重新构建；换编译器或编译器版本会让整个目录的缓存失效。

库目标还会进全局缓存：`$CLUE_HOME/cache/build/<triple>/<profile>/<fingerprint>/`，命中时打印上面那条 `clue: cached library` 消息，并从缓存恢复产物。关掉它有两种方式：清单里写 `[build] cache = false`，或者设 `CLUE_BUILD_CACHE=0`。二进制目标不走这个缓存。

`clue clean` 只删包的 `.clue/build`，工作区下每个成员加根各删一次，不碰 `$CLUE_HOME` 里的全局内容。

## 环境变量

| 变量 | 作用 |
| --- | --- |
| `CLUE_HOME` | 全局目录；未设置时依次取 `$USERPROFILE/.clue`、`$HOME/.clue`，都没有时报 `cannot determine Clue home; set CLUE_HOME` |
| `CLUE_OFFLINE` | 强制离线，取值 `1`/`true`/`yes` 或 `0`/`false`/`no` |
| `CLUE_JOBS` | 并行构建数，必须是正整数；也可用 `-j` 覆盖 |
| `CLUE_BUILD_CACHE` | 只有字面值 `0` 会关闭全局库缓存 |
| `CLUE_REGISTRY_INDEX` / `CLUE_REGISTRY_TOKEN` | 覆盖默认 registry 的 index 与 token |
| `RIDDLE_TARGET` | 默认交叉目标，优先级低于 `--target`、高于 `[build].target` |
| `CC` | 指定 C 编译器，设置后不再探测其它候选 |

registry 的默认名字是 `default`，默认 index 是 `https://registry.riddle-lang.org/index`。全局配置在 `$CLUE_HOME/config.toml`，项目配置在 `<项目>/.clue/config.toml` 并覆盖全局；`[registries.<name>]` 里的 `index`、`api`、`token` 是唯一记录 registry 的地方，`Clue.toml` 里没有 `[registries]`。

## C 工具链

`clue build`、`clue run`、`clue test`、`clue bench`、`clue install` 都要把 C 编译并链接起来，探测顺序按平台组合分三档：

| 情形 | 依次尝试 |
| --- | --- |
| Windows 宿主，Windows 目标 | `clang-cl`、`clang`、`cc`、`gcc`、`cl` |
| 其它宿主，Windows 目标 | `clang`、`cc`、`gcc`、`clang-cl` |
| 其余组合 | `clang`、`cc`、`gcc` |

这之后还会扫描 `PATH` 里形如 `clang-cl-<n>`、`clang-<n>`、`gcc-<n>` 的程序，按版本降序尝试；每个候选都要真的编译链接出一个可执行文件才会被采用。设置 `CC` 就只用它，失败时直接报错而不是退回探测。库目标另需归档工具 `ar`，或者 MSVC flavor 下的 `llvm-lib` / `lib`。完整报错文本和交叉编译所需的目标组件见[安装工具链](./install.md)。
