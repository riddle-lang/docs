# FFI 与工具链

本页汇总当前仓库里和语言使用直接相关的工具、后端和 FFI 能力。

## riddlec

`riddlec` 是当前命令行编译器入口：

```bash
riddlec [--verbose] [--backend c] [--output <file>] <file>...
```

常用参数：

| 参数 | 作用 |
|------|------|
| `--verbose`, `-v` | 打印 parse、HIR lower、type check、move/escape analysis、MIR lowering 的状态 |
| `--backend c`, `-b c` | 使用 C backend 生成代码 |
| `--output <file>`, `-o <file>` | 指定输出文件 |
| `--version`, `-V` | 打印构建时 git commit hash |
| `--help`, `-h` | 打印帮助 |

`riddlec` 会自动把 `std/prelude.rid` 拼到用户源码后面，因此基础 lang trait 不需要手动引入。

## C backend

使用 C backend：

```bash
cargo run -p riddlec -- --backend c examples/index.rid
```

`riddlec` 会生成 C 代码，然后查找 `cc`、`gcc` 或 `clang` 编译成本机可执行文件。C backend 需要系统中有 C 编译器和 Boehm GC，链接参数为 `-lgc`。

`--output` 的行为：

- `--output app`：写出 `app.c`，再编译为 `app` 或 Windows 下的 `app.exe`；
- `--output app.c`：只写出 C 源码，不继续编译；
- 不写 `--output`：按第一个输入文件名派生输出名。

## extern "C"

Riddle 支持声明外部 C 函数：

```riddle
extern "C" {
    fun abs(x: i32) -> i32;
}

fun main() {
    let value = abs(-42);
}
```

也支持导出 C ABI 函数：

```riddle
extern "C" fun add(x: i32, y: i32) -> i32 {
    x + y
}
```

字符串 FFI 中，`str` 和 `&str` 在 Riddle 内部是胖指针；传给外部 C 函数时，C backend 会把它们作为 `const char*` 传出。

```riddle
extern "C" fun puts(s: str) -> i32;

fun main() {
    puts("hello from riddle");
}
```

## unsafe、原始指针和 as

低层代码可以使用 `unsafe` 块、原始指针类型和 `as` 转换：

```riddle
extern "C" {
    fun my_alloc(size: usize) -> *const i32;
}

fun main() {
    unsafe {
        let p: *const i32 = my_alloc(16);
        let n = 42 as f64;
    }
}
```

当前 `unsafe` 主要是语法和语义边界；原始指针不参与普通引用那套借用检查。

## info-viz

仓库还包含 `app/info-viz`，用于本地查看 Riddle 源码的语义消息可视化。它的 CLI 入口设计为：

```bash
info-viz [--addr 127.0.0.1:7878] [source.rid]
```

当前根 `Cargo.toml` 没有把 `app/info-viz` 列入 `workspace.members`，直接 `cargo run -p info-viz` 不可用。需要先把它加入 workspace 或单独调整 manifest 后再构建运行。

如果不传源文件，它会打开内置示例。支持参数：

| 参数 | 作用 |
|------|------|
| `--addr <addr>` | 指定监听地址，默认 `127.0.0.1:7878` |
| `--version`, `-V` | 打印构建时 git commit hash |
| `--help`, `-h` | 打印帮助 |

## 小结

- `riddlec` 当前暴露 C backend；
- C backend 依赖本机 C 编译器和 Boehm GC；
- `extern "C"` 支持声明外部函数和导出函数；
- `unsafe`、原始指针和 `as` 已进入当前语言；
- `info-viz` 是本地语义消息可视化工具代码，当前未接入根 workspace。
