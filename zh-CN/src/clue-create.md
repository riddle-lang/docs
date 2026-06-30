# 创建项目

本页从一个空目录开始创建并构建 Clue 项目。

## 创建项目

```bash
clue init hello
```

这会创建 `hello/Clue.toml` 和 `hello/.gitignore`。`Clue.toml` 的初始内容如下：

```toml
[package]
name = "hello"
version = "0.1.0"

[dependencies]
```

`.gitignore` 会忽略 `/.clue`，也就是 Clue 的构建缓存和输出目录。

`clue init` 不会自动创建入口源码。通常需要手动添加：

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
2. `<package-name>.rid`
3. `main.rid`

构建时会展开 `mod name;`：

- 优先读取同目录下的 `name.rid`；
- 如果不存在，再读取 `name/mod.rid`。

如果找不到入口文件，Clue 会报错：

```text
missing entry file; expected src/main.rid, <package>.rid, or main.rid
```

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

`[dependencies]` 当前只是清单占位，Clue 还不会解析依赖包。

