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

## riddle-lsp

`riddle-lsp` 是 Riddle 的 Language Server Protocol 实现，基于 `tower-lsp`。它为编辑器提供实时诊断：

```bash
cargo run -p riddle-lsp
```

它通过 stdin/stdout 与编辑器通信，每次按键运行完整编译流程（解析 → HIR 降级 → 作用域图 → 类型检查 → 逃逸分析 → move check），然后通过 LSP 推送诊断：

- **解析错误**：来自词法/语法分析阶段；
- **HIR 诊断**：包括 E0040（降级错误）、E0050/E0051/E0052（名字解析错误）；
- **类型检查诊断**：E0001–E0034、E0072 等类型和 trait 检查错误；
- **分析诊断**：E0100 移动语义、E0300–E0304 借用冲突。

诊断附带：
- 次要标签（related information）指向关联位置；
- 注释（notes）提供上下文；
- 帮助消息（help）提供修复建议；
- 严重性分层：Error、Warning、Information、Hint。

配置编辑器（以 VS Code 为例），在 LSP 客户端配置中添加：

```json
{
    "languageServers": ["riddle-lsp"]
}
```

或将 `riddle-lsp` 注册为 `.rid` 文件的 language server。

## MIR 后端架构

MIR 后端通过统一的 `Backend` trait 实现：

```rust
trait Backend {
    fn compile(&mut self, module: &Module) -> Result<String, Error>;
    fn name(&self) -> &'static str;
}
```

目前已实现的四个后端：

| 后端 | 文件 | 状态 |
|------|------|------|
| C | `crates/mir/src/backend/c.rs` | CLI 可用（`--backend c`） |
| Cranelift | `crates/mir/src/backend/cranelift.rs` | 代码和测试齐全，CLI 未暴露 |
| JavaScript | `crates/mir/src/backend/js.rs` | 代码和测试齐全，CLI 未暴露 |
| Lua | `crates/mir/src/backend/lua.rs` | 代码和测试齐全，CLI 未暴露 |

## 小结

- `riddlec` 当前暴露 C backend；
- C backend 依赖本机 C 编译器和 Boehm GC；
- `extern "C"` 支持声明外部函数和导出函数；
- `unsafe`、原始指针和 `as` 已进入当前语言；
- `riddle-lsp` 提供编辑器实时诊断；
- MIR 支持四种后端（C / Cranelift / JS / Lua），通过统一 `Backend` trait 实现。
