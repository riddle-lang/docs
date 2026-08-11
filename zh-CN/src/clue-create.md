# 创建与构建项目

本页从一个空目录开始创建并构建 Clue 项目。

## 创建项目

```bash
clue new hello
```

`new` 要求目标目录不存在。要在已有目录中初始化项目，可以运行 `clue init .`。`--bin` 是默认值，也可以用 `clue new --lib math` 创建库项目。要创建只负责注册子 crate 的虚拟工作区，可以运行 `clue new workspace --workspace`。

这会创建 `hello/Clue.toml`、`hello/.gitignore` 和 `hello/src/main.rid`。`Clue.toml` 的初始内容如下：

```toml
[package]
name = "hello"
version = "0.1.0"

[[bin]]
name = "hello"
path = "src/main.rid"

[dependencies]
```

`.gitignore` 会忽略 `/.clue`，也就是 Clue 的构建缓存和输出目录。

库项目改为生成 `[lib]` 目标和 `src/lib.rid`：

```toml
[lib]
name = "math"
path = "src/lib.rid"
```

`init` 和 `new` 都不会覆盖已有的 `Clue.toml` 或目标入口源码。默认生成的二进制入口为：

```riddle
fun main() {
}
```

## 构建项目

```bash
clue build hello
```

也可以在项目目录内运行：

```bash
clue build
```

清单中的 `[[bin]].path` 或 `[lib].path` 指定入口。单个二进制目标时，旧式 `[package].entry` 的优先级更高；多个 `[[bin]]` 各自使用 `path`，`clue build` 默认构建全部，也可以用 `clue build --bin <name>` 只构建一个。没有显式目标时，`clue build` 按包类型寻找入口文件。二进制包依次检查 `src/main.rid`、`src/lib.rid`、`<package-name>.rid`、`main.rid`；库和过程宏包依次检查 `src/lib.rid`、`<package-name>.rid`、`lib.rid`、`src/main.rid`。

旧清单也可以在 `[package]` 中指定入口文件：

```toml
[package]
name = "hello"
entry = "src/bin/hello.rid"
version = "0.1.0"
```

构建时会按 Rust 风格展开 `mod name;`，只有被 `mod` 声明的文件会加入编译：

- 在当前模块目录下读取 `name.rid` 或 `name/mod.rid`；
- `name.rid` 和 `name/mod.rid` 同时存在会报错；
- 进入 `name` 模块后，子模块会继续从 `name/` 目录下寻找。

例如 `src/main.rid` 写了 `mod foo;`，会读取 `src/foo.rid` 或 `src/foo/mod.rid`。如果 `src/foo/mod.rid` 里再写 `mod bar;`，会读取 `src/foo/bar.rid` 或 `src/foo/bar/mod.rid`。仅仅存在 `src/foo/mod.rid` 但没有 `mod foo;` 时，这个目录不会被编译。

如果找不到入口文件，Clue 会报错：

```text
missing entry file; expected src/main.rid, src/lib.rid, <package>.rid, main.rid, or lib.rid
```

## 使用本地依赖

Clue 支持本地 path 依赖。假设有两个相邻包：

```text
workspace/
  hello/
    Clue.toml
    src/main.rid
  math/
    Clue.toml
    src/lib.rid
```

`hello/Clue.toml` 可以写成：

```toml
[package]
name = "hello"
version = "0.1.0"

[dependencies]
math = { path = "../math" }
```

如果依赖包名不能直接当模块名，可以像 Cargo 一样用 `package` 指向真实包名：

```toml
[dependencies]
math = { package = "math-core", path = "../math-core" }
```

依赖键会作为模块名出现在 `hello` 包中：

```riddle
fun main() -> i32 {
    math::one()
}
```

依赖包会使用自己的入口规则，也可以在依赖包的 `[package]` 中设置 `entry`。当前只支持本地 path 依赖，不支持版本解析、git 依赖或远程 registry。单包项目会在项目根目录维护 `Clue.lock`；工作区会在根目录维护一个统一的锁文件。

作为依赖加载时，Clue 会优先读取依赖包的 `[lib].path`；没有 `[lib]` 目标时，默认先寻找 `src/lib.rid`。依赖包中要被外部包使用的项需要写成 `pub`：

```riddle
pub fun one() -> i32 {
    1
}
```

也就是说，`math/src/lib.rid` 中的私有函数仍只能被 `math` 包内部使用，`hello` 只能通过 `math::one()` 访问 `pub` 导出的项。模块、`use` 和可见性规则见[模块、use 与包](./modules.md)。

## 使用工作区

工作区根目录的 `Clue.toml` 只注册子 crate：

```toml
[workspace]
crates = ["hello", "math"]
```

`hello/Clue.toml` 和 `math/Clue.toml` 仍分别声明自己的 `[package]`、目标和依赖。根目录执行 `clue check` 或 `clue build` 会按依赖顺序处理所有注册 crate；在子 crate 目录执行时默认只处理当前 crate，`--workspace` 选择全部，`--package <name>` 选择一个。工作区中的包和包内二进制分别用 `--package <name>` 与 `--bin <name>` 选择。

Clue 会在根目录生成 `Clue.lock`，其中以 `path = "..."` 记录相对根目录的本地包路径、版本、依赖关系和源码内容指纹。`--locked` 会拒绝缺失或过期的锁文件。子 crate 不生成锁文件。工作区内部的 path 依赖必须同时出现在 `workspace.crates` 中。

## 输出文件

二进制项目会保留生成的 C 源码，并输出本机可执行文件。默认宿主 debug 构建使用兼容旧版本的目录；`--release` 和交叉目标使用独立目录：

```text
.clue/build/<bin-name>.c
.clue/build/<bin-name>       # Linux/macOS
.clue/build/<bin-name>.exe   # Windows
.clue/build/<target>/release/<bin-name>[.exe]
```

构建成功时会输出：

```text
clue: built .clue/build/hello.exe
```

实际路径会随平台变化。源码、`Clue.toml`、编译器版本和 C 编译器选择都没变化时，再次运行会复用缓存：

```text
clue: fresh .clue/build/hello.exe
```

库项目只生成 `.clue/build/<package-name>.c`。二进制项目可以直接运行：

```bash
clue run hello
clue run hello -- arg1 arg2
```

设置 `CC` 时 Clue 会严格使用指定的 C 编译器；否则先尝试目标组件 `c-toolchain.toml` 中配置的编译器（由 `ridup target configure` 设置），再探测 `clang`、`cc`、`gcc`（Windows 目标额外尝试 `clang-cl` 和 `cl`），最后尝试带版本后缀的 GCC/Clang。只有能完成 C11 编译和链接的候选才会被采用。
