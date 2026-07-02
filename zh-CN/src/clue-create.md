# 创建项目

本页从一个空目录开始创建并构建 Clue 项目。

## 创建项目

```bash
clue init hello
```

`--bin` 是默认值，也可以用 `clue init --lib math` 创建库包清单。

这会创建 `hello/Clue.toml` 和 `hello/.gitignore`。`Clue.toml` 的初始内容如下：

```toml
[package]
name = "hello"
version = "0.1.0"

[dependencies]
```

`.gitignore` 会忽略 `/.clue`，也就是 Clue 的构建缓存和输出目录。

`clue init --lib` 会在 `[package]` 中写入 `entry = "src/lib.rid"`。`clue init` 不会自动创建入口源码，通常需要手动添加：

```text
hello/
  Clue.toml
  src/
    main.rid
```

例如：

```riddle
fun main() -> i32 {
    0
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

`clue build` 会按顺序寻找入口文件：

1. `src/main.rid`
2. `src/lib.rid`
3. `<package-name>.rid`
4. `main.rid`

也可以在 `Clue.toml` 中指定入口文件：

```toml
[package]
name = "hello"
entry = "src/bin/hello.rid"
version = "0.1.0"
```

构建时会展开 `mod name;`：

- 优先读取同目录下的 `name.rid`；
- 如果不存在，再读取 `name/mod.rid`。

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

依赖包会使用自己的入口规则，也可以在依赖包的 `[package]` 中设置 `entry`。当前只支持 Cargo 风格的本地 path 依赖，不支持版本解析、lockfile、git 依赖或远程 registry。

作为依赖加载时，Clue 会优先读取依赖包的 `src/lib.rid`。依赖包中要被外部包使用的项需要写成 `pub`：

```riddle
pub fun one() -> i32 {
    1
}
```

也就是说，`math/src/lib.rid` 中的私有函数仍只能被 `math` 包内部使用，`hello` 只能通过 `math::one()` 访问 `pub` 导出的项。模块、`use` 和可见性规则见 [模块、use 与枚举](./modules-and-enums.md)。

## 输出文件

当前输出是 C 源码，路径为：

```text
.clue/build/<package-name>.c
```

构建成功时会输出：

```text
clue: built .clue/build/hello.c
```

源码、`Clue.toml` 和编译器版本都没变化时，再次运行会复用缓存：

```text
clue: fresh .clue/build/hello.c
```
