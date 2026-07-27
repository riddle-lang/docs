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
| `--version`, `-V` | 打印版本号和构建时 git commit hash |
| `--help`, `-h` | 打印帮助 |

`riddlec` 会自动把 `std/lib.rid` 拼到用户源码后面，因此基础 lang trait 不需要手动引入。

## C backend

使用 C backend：

```bash
clue new hello
cargo run -p riddlec -- --backend c --output hello.c hello/src/main.rid
```

`riddlec` 只生成包含 `rgc` ABI 调用的 C 源码，不再内嵌具体 GC。手动构建时需要同时编译一个运行时实现；仓库中的默认实现位于 `crates/gc/src/runtime.c`：

```bash
cc hello.c crates/gc/src/runtime.c -o hello
```

`clue build` 会自动选择并编译默认运行时，也可以通过 `Clue.toml` 的 `[runtime].source` 使用自定义 GC 或分配器。

当前 C backend 会把 Riddle 的结构体生成为 C `struct`，固定长度数组生成为 C 数组字段，初始化含数组字段的结构体时使用 `memcpy` 复制数组存储。枚举值会生成为带 `tag` 和 payload 字段的结构体表示。raw string 会按 C 字符串规则转义后输出。

`--output` 的行为：

- `--output app`：写出 `app.c`；
- `--output app.c`：写出 `app.c`；
- 其他输出名会追加 `.c`，例如 `--output app.h` 写出 `app.h.c`；
- 不写 `--output`：按第一个输入文件名派生 `.c` 输出名。

## extern "C"

外部 C 函数声明块必须使用 `unsafe extern`。块内函数默认不安全，只有显式标记为 `safe fun` 的声明才能在安全代码中调用；`safe` 不能在普通 `extern` 中使用：

```riddle
unsafe extern "C" {
    safe fun abs(x: i32) -> i32;
    fun malloc(size: usize) -> *mut u8;
}

fun main() {
    let value = abs(-42);
    let pointer = unsafe { malloc(16) };
}
```

`extern` 声明描述一个确定的 C ABI 符号，因此不允许泛型参数。需要泛型封装时，应在普通 Riddle 泛型函数中调用具体的非泛型 FFI 声明。

C backend 不按符号名提供内置 C 函数；每个声明都会生成普通外部符号引用，由系统库、用户 C 代码或所选运行时负责链接。

`safe fun` 是声明者对整个调用契约的承诺；错误标记可能让安全代码触发未定义行为。

也支持导出 C ABI 函数：

```riddle
extern "C" fun add(x: i32, y: i32) -> i32 {
    x + y
}
```

字符串 FFI 不接受裸 `str` 参数或返回值。`&str` 在 Riddle 内部是胖指针；调用只有声明、没有函数体的 C 导入时，C backend 会把参数的 `ptr` 作为 `const char*` 传出。若导入返回 `&str`，返回指针必须以 NUL 结尾，长度由 `strlen` 恢复。

```riddle
unsafe extern "C" {
    fun puts(s: &str) -> i32;
}

fun main() {
    unsafe { puts("hello from riddle"); }
}
```

带函数体的 `extern "C"` 是导出定义，不会再作为导入重复声明。它的 `&str` 参数和返回值保留 `riddle_str { ptr, len }` C 结构体 ABI，以免丢失长度。

## unsafe、原始指针和 as

低层代码可以使用 `unsafe fun`、`unsafe` 块、原始指针类型和 `as` 转换：

```riddle
unsafe extern "C" {
    fun my_alloc(size: usize) -> *const i32;
}

unsafe fun read(ptr: *const i32) -> i32 {
    unsafe { *ptr }
}

fun main() {
    unsafe {
        let p: *const i32 = my_alloc(16);
        let value = read(p);
        let n = 42 as f64;
    }
}
```

原始指针解引用、原始指针索引以及调用 `unsafe fun` 都必须位于 `unsafe {}` 中。`unsafe fun` 的函数体本身仍从安全上下文开始，内部不安全操作需要显式块。`unsafe` 不会关闭类型、可变性、move 或借用检查；原始指针不参与普通引用的借用跟踪。

函数类型同样携带安全属性：`fun(A) -> B` 可以转换为 `unsafe fun(A) -> B`，反向转换会被拒绝。调用不安全函数值仍需要 `unsafe {}`。

## riddle-lsp

`riddle-lsp` 是 Riddle 的 Language Server Protocol 实现，基于 `tower-lsp`。它为编辑器提供实时诊断：

```bash
cargo run -p riddle-lsp
```

它通过 stdin/stdout 与编辑器通信，每次按键运行完整编译流程（解析 → HIR 降级 → 作用域图 → 类型检查 → 逃逸分析 → move check），然后刷新所有已打开文档的诊断：

- **解析错误**：来自词法/语法分析阶段；
- **HIR 诊断**：包括 E0040（降级错误）、E0050/E0051/E0052（名字解析错误）；
- **类型检查诊断**：E0001–E0034、E0072 等类型和 trait 检查错误；
- **分析诊断**：E0100 移动语义、E0300–E0304 借用冲突。

诊断附带：
- 次要标签（related information）指向关联位置；
- 注释（notes）提供上下文和修复建议；
- 严重性分层：Error、Warning、Information、Hint。

仓库中的 `editors` 目录提供 Helix、VS Code、Zed 和 IntelliJ IDEA 2026.1+ 客户端。完整的安装、路径配置、验证步骤和故障排查见[编辑器与 LSP](./editor-support.md)。

## MIR 后端架构

MIR 后端通过统一的 `Backend` trait 实现：

```rust
trait Backend {
    fn compile(&mut self, module: &Module) -> Result<String, Error>;
    fn name(&self) -> &'static str;
}
```

目前实现并维护的后端：

| 后端 | 文件 | 状态 |
|------|------|------|
| C | `crates/mir/src/backend/c.rs` | CLI 可用（`--backend c`） |
