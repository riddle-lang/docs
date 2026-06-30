# Clue 构建器

`clue` 是 Riddle 当前的项目构建器。它提供两个命令：

```bash
clue init <path>
clue build [path]
```

`clue init` 创建项目清单和忽略文件；`clue build` 读取 `Clue.toml`，找到入口 `.rid` 文件，展开外部模块声明，然后生成 C 源码。

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
2. `<package-name>.rid`
3. `main.rid`

## 构建缓存

Clue 会缓存构建指纹。`Clue.toml`、展开后的源码或当前编译器版本发生变化时会重新生成 C 源码；没有变化时会输出 `fresh`。

## 当前限制

- `[dependencies]` 目前只是清单占位，不会下载或解析依赖；
- 输出固定为 C 源码文件；
- 运行生成的 C 程序仍需使用 C 编译器和 Boehm GC，或直接使用 `riddlec --backend c`。
