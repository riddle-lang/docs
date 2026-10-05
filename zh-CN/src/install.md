# 安装 Riddle 工具链

工具链是四个可执行文件：`clue`（项目与依赖）、`riddle`（fmt / run / repl）、`riddlec`（编译器）、`riddle-lsp`（语言服务器）。当前版本 0.3.0，预编译包和源码构建两种装法都可以。

## 下载预编译包

[GitHub Releases](https://github.com/riddle-lang/riddle/releases) 为 7 个宿主平台各提供一个 zip，文件名形如 `riddle-v<version>-<platform>-<arch>.zip`：

| 文件名 | 宿主 |
| --- | --- |
| `riddle-v0.3.0-linux-x86_64.zip` | x86_64 Linux |
| `riddle-v0.3.0-linux-aarch64.zip` | aarch64 Linux |
| `riddle-v0.3.0-linux-i686.zip` | i686 Linux |
| `riddle-v0.3.0-windows-x86_64.zip` | x86_64 Windows |
| `riddle-v0.3.0-windows-i686.zip` | i686 Windows |
| `riddle-v0.3.0-windows-aarch64.zip` | aarch64 Windows |
| `riddle-v0.3.0-macos-aarch64.zip` | Apple Silicon macOS |

包内是 `clue`、`riddle-lsp`、`riddlec`、`riddle`（Windows 上带 `.exe`），以及 `LICENSE`、`README.md` 和 `crates/gc/src/runtime.c`。解压后把目录加入 `PATH`，再确认版本：

```text
> clue --version
clue 0.3.0
> riddle --version
riddle 0.3.0 (3a783d1)
> riddlec --version
riddlec 0.3.0 (3a783d1)
> riddle-lsp --version
riddle-lsp 0.3.0 (3a783d1)
```

`clue` 只打印版本号；另外三个会附加构建时的 git 短哈希，所以实际输出里的哈希与这里不同。

Release 里还有第二类 zip，文件名形如 `riddle-v<version>-target-<triple>.zip`，只面向交叉编译。它不含可执行文件，内容是 `LICENSE`、`runtime.c` 和一份 `target.toml`：

```toml
schema = 1
triple = "aarch64-unknown-linux-gnu"
runtime = "runtime.c"
llvm_version = "22.1.3"
```

这正是 clue 在 `--target` 构建时读取的目标组件格式，字段含义见下面的交叉编译一节。

## 从源码构建

仓库用 `rust-toolchain.toml` 固定 `channel = "1.97.1"`，rustup 进入仓库目录时会自动使用这个工具链。

```bash
git clone --depth 1 https://github.com/riddle-lang/riddle.git
cd riddle
cargo install --path . --features install-bins --force --target-dir "${TMPDIR:-/tmp}/riddle-install"
```

```powershell
git clone --depth 1 https://github.com/riddle-lang/riddle.git
Set-Location riddle
cargo install --path . --features install-bins --force --target-dir "$env:TEMP\riddle-install"
```

一条命令装齐四个二进制。`install-bins` 是根发行包 `riddle` 的 feature，负责暴露 `clue`、`riddlec`、`riddle-lsp` 三个安装入口；`riddle` 本身不需要它。`--target-dir` 把中间产物放到仓库的 `target/` 之外，避免污染工作副本。

`cargo install riddle` 从 crates.io 安装走不通。根包和 `clue`、`riddlec`、`riddle-lsp` 三个成员 crate 都是 `publish = false`，彼此之间全部是 path 依赖，所以安装源只能指向仓库根。

只想构建、不想安装到 `~/.cargo/bin` 时：

```bash
cargo build -p riddle --release --features install-bins --bins
```

不要把 `--all-features` 加到 workspace 范围的 Cargo 命令上。根发行包与成员 crate 都会产出名为 `clue`、`riddlec` 的二进制，Cargo 会报输出文件碰撞；上面这条指定了 `-p riddle`，不会触发。

改动工具链源码后，仓库的常规校验是：

```bash
cargo test --workspace --all-targets
cargo check -p riddle --features install-bins --bins
cargo fmt --all -- --check
cargo clippy --workspace --all-targets --all-features -- -D warnings
```

最后一条把 Clippy 默认规则集的告警当成错误；`pedantic`、`nursery`、`cargo` 属于可选的额外类别，不是合并门槛。

## C 工具链

`clue build`、`clue run`、`clue test`、`clue bench`、`clue install` 会把生成的 C 编译再链接成本机可执行文件，需要系统里有一个能编 C11 的编译器兼链接器。下面这些命令不需要 C 工具链：

- `riddle run`、`riddle repl`：直接用内置 MIR 解释器执行；
- `riddle fmt`：只调整空白，不编译；
- `riddlec --emit mir`：打印中间表示；`riddlec --backend c`：只写 C 源码，不调用系统编译器；
- `clue check`、`riddle-lsp`：只做前端分析与编辑功能，接入编辑器见[编辑器与 LSP](./editor-support.md)。

探测顺序按目标平台分三档：

| 情形 | 依次尝试 |
| --- | --- |
| 宿主是 Windows，目标也是 Windows | `clang-cl`、`clang`、`cc`、`gcc`、`cl` |
| 非 Windows 宿主，目标是 Windows | `clang`、`cc`、`gcc`、`clang-cl` |
| 其它 | `clang`、`cc`、`gcc` |

三档都落空后还会扫描 `PATH` 里形如 `clang-cl-<n>`、`clang-<n>`、`gcc-<n>` 的文件，按版本降序尝试。每个候选都要通过一次真实的编译链接探测——编译 `int main(void) { return 0; }` 并检查产物是否生成，通过的记录成构建目录里的 `.cc-<identity>` 标记文件。非宿主目标只接受 clang。

设置 `CC` 后就不再探测其它候选，失败时依次可能是：

```text
C compiler from CC `...` could not report its version
C compiler from CC `...` cannot compile and link C11
no usable C11 compiler and linker found; tried <候选列表>; set CC to a compiler executable
```

构建库目标还要归档工具：Unix flavor 用 `ar`（`ar crs`），MSVC flavor 用 `llvm-lib`（clang）或 `lib`。

## 交叉编译

`clue check --target`、`clue build --target` 和 `riddlec --target` 接受的目标恰好七个，其它 triple 会被拒绝：

- `x86_64-unknown-linux-gnu`
- `aarch64-unknown-linux-gnu`
- `i686-unknown-linux-gnu`
- `x86_64-pc-windows-msvc`
- `i686-pc-windows-msvc`
- `aarch64-pc-windows-msvc`
- `aarch64-apple-darwin`

目标选择优先级是 `--target`、环境变量 `RIDDLE_TARGET`、`Clue.toml` 里的 `[build].target`，都没有才用宿主。

非宿主目标需要目标组件。组件根目录取自环境变量：`RIDDLE_TARGET_ROOT` 指向组件目录本身，`RIDUP_TOOLCHAIN_ROOT` 则指向包含 `targets/` 的工具链根；两者都没设置时 clue 直接报缺组件。缺组件和缺系统组件的报错都把补救命令写在消息里：

```text
target component `aarch64-unknown-linux-gnu` is not installed; run `ridup target add aarch64-unknown-linux-gnu`
C toolchain for `aarch64-unknown-linux-gnu` is missing a Linux sysroot; run `ridup target configure aarch64-unknown-linux-gnu --sysroot <path>`
```

macOS 目标缺 Apple SDK、Windows 跨目标缺 Windows SDK 或 MSVC 路径时报错结构相同，参数分别是 `--sysroot` 和 `--windows-sdk` / `--msvc`。

## ridup

[ridup](https://github.com/riddle-lang/ridup) 是仓库外的独立工具链管理器：下载发行包、切换工具链、安装目标组件都由它负责，命令细节以它自己的文档为准。clue 与它之间只有上文两个接口——组件的存放位置，以及错误消息里出现的那几条命令。

安装 ridup 本身：

```bash
cargo install --git https://github.com/riddle-lang/ridup --locked
```

## 常见问题

**`cargo build` 报 Rust 版本不够。** 仓库固定 Rust 1.97.1，确认 rustup 已安装该工具链：`rustup toolchain install 1.97.1`。在仓库目录里 rustup 会按 `rust-toolchain.toml` 自动选用。

**`clue build` 报找不到 C11 编译器。** 装一个 clang 或 gcc，或者用 `CC` 指定绝对路径，例如 `CC=C:\LLVM\bin\clang.exe`。

**仓库里没有 `examples/` 目录。** 示例以本书的可运行代码和 `clue new` 生成的项目为准。
