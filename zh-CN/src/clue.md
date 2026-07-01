# Clue 构建器

`clue` 是 Riddle 当前的项目构建器。它提供两个命令：

```bash
clue init <path>
clue build [path]
```

`clue init` 创建项目清单和忽略文件；`clue build` 读取 `Clue.toml`，找到入口 `.rid` 文件，展开外部模块声明和本地依赖包，然后生成 C 源码。

Clue 适合把多文件 Riddle 程序放进一个项目目录里构建。它不会替代 `riddlec` 的所有参数：当前输出固定为 `.clue/build/<package-name>.c`，也不会继续调用 C 编译器生成本机可执行文件。

## 项目布局

推荐布局：

```text
hello/
  Clue.toml
  src/
    main.rid
```

`clue build` 会按顺序寻找入口：

1. `src/main.rid`
2. `src/lib.rid`
3. `<package-name>.rid`
4. `main.rid`

也可以在 `[package]` 中显式指定入口：

```toml
[package]
name = "hello"
entry = "src/bin/hello.rid"
version = "0.1.0"
```

## 本地依赖

`[dependencies]` 目前支持本地 path 依赖：

```toml
[dependencies]
math = { path = "../math" }
```

也支持 Cargo 风格的重命名。依赖键会成为当前包里的模块名，`package` 指向依赖包自己的 `[package].name`：

```toml
[dependencies]
math = { package = "math-core", path = "../math-core" }
```

源码中按模块路径使用依赖键：

```riddle
fun main() -> i32 {
    math::one()
}
```

依赖包也使用自己的 `Clue.toml` 和入口文件。依赖键必须是合法模块名，也就是字母或 `_` 开头，后面跟字母、数字或 `_`。

作为依赖加载时，Clue 会优先使用 `src/lib.rid`，再退回 `<package-name>.rid`、`lib.rid` 和 `src/main.rid`。依赖包需要用 `pub` 导出给调用方使用的函数、类型、模块或 `use` 重新导出。

模块、`use`、`pub use` 和可见性规则见 [模块、use 与枚举](./modules-and-enums.md)。

## 构建缓存

Clue 会缓存构建指纹。`Clue.toml`、展开后的源码或当前编译器版本发生变化时会重新生成 C 源码；没有变化时会输出 `fresh`。

## 当前限制

- 只支持 Cargo 风格的本地 path 依赖，不支持 registry、版本解析、git 依赖或 lockfile；
- 输出固定为 C 源码文件；
- 运行生成的 C 程序仍需使用 C 编译器和 Boehm GC，或直接使用 `riddlec --backend c`。
