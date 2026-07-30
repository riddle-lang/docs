# Riddle 过程宏 v1 设计

日期：2026-07-31

## 目标

为 Riddle 增加 Rust 风格的过程宏机制。第一版只支持 derive 宏，宏代码使用 Riddle 编写，宏通过 `TokenStream -> TokenStream` 接口接收和生成语法令牌。

设计重点是保持现有解析、HIR、类型检查、MIR 和 C 后端流程不变：过程宏在 HIR 之前完成展开，展开后的代码重新进入现有编译流水线。

## 范围

第一版支持：

- 独立的过程宏库目标。
- `#[proc_macro_derive(...)]` 导出声明。
- `TokenStream`、`TokenTree`、`Span` 和 `Diagnostic` API。
- host/target 分离编译。
- 独立 host 宏执行器和版本化 IPC。
- derive 输出的语法验证、重新解析和错误映射。

第一版不支持：

- attribute macro。
- function-like macro。
- `macro_rules!`。
- 完整 Rust hygiene。
- 跨编译的展开结果缓存。
- 宏沙箱。
- 类似 `syn` 的完整 AST 解析库或类似 `quote!` 的模板 DSL。

## 用户接口

过程宏库使用专用库目标：

```toml
[package]
name = "display_macros"

[lib]
proc-macro = true
```

宏包源代码导出 derive 函数：

```riddle
#[proc_macro_derive(Display, attributes(display))]
pub fun derive_display(input: TokenStream) -> TokenStream {
    ...
}
```

使用方通过普通依赖引用宏包：

```toml
[dependencies]
display_macros = { path = "../display_macros" }
```

调用时使用包名限定的 derive 路径：

```riddle
#[derive(display_macros::Display)]
struct User {
    name: String,
}
```

v1 采用限定路径来避免宏名冲突；导入后使用未限定宏名属于后续兼容性扩展。

过程宏包不需要用户提供 `main`。编译器为它生成隐藏的 host 执行入口，并登记所有 `proc_macro_derive` 导出函数。

## 包和构建模型

Clue 将依赖图分成两类：

- 普通包按目标平台编译，并参与最终程序链接。
- 过程宏包及其依赖按 host 平台编译，只生成编译期宏执行器。

过程宏包不会进入目标程序的链接图。过程宏包之间的循环依赖直接报错。过程宏包源代码或其 host 依赖发生变化时，当前编译会重新构建宏执行器。

一次编译中，每个过程宏包最多启动一个宏执行器进程；同一包的多个 derive 调用顺序复用该进程。v1 不缓存跨编译的宏结果。

## 组件边界

实现由以下逻辑组件组成：

1. **过程宏 API**：定义 `TokenStream`、`TokenTree`、`Span`、`Diagnostic` 及其构造和遍历接口。
2. **宏执行器运行时**：读取 IPC 请求，查找已登记的 derive 函数，执行并返回结果。
3. **编译器宏调用器**：解析宏包导出、启动 host 进程、发送请求、接收响应并处理失败。
4. **展开阶段**：在 HIR 生成之前解析 derive，合并输出，生成展开源映射并重新解析。
5. **Clue 构建分类**：识别 `proc-macro = true`，分别构建 host 和 target 依赖图。

LSP 和命令行编译共用同一展开服务，不实现第二套宏调用路径。

## TokenStream API

基础令牌类型为：

```text
TokenStream
TokenTree
  Group
  Ident
  Punct
  Literal
Span
Diagnostic
```

`Group` 携带分隔符和嵌套令牌；`Punct` 携带字符和 spacing；所有令牌都可携带 Span。

语义规则：

- 宏输入令牌保留原始源文件 Span。
- 宏新建令牌默认使用 `Span::call_site()`。
- Span 作为宏 API 的不透明值使用；宏可以复制和附加 Span，但不能伪造编译器内部源文件身份。
- 生成的辅助标识符使用 `__riddle_` 前缀，降低与用户代码冲突的概率。
- v1 不承诺完整 Rust hygiene；宏生成代码仍可能依赖调用处的名称作用域。

宏作者直接使用 TokenStream API 解析和拼接令牌。类型化 AST 工具和模板 DSL 不属于编译器核心接口。

## IPC 协议

宏执行器通过本机标准输入和标准输出通信。标准输出只用于协议，宏日志写入标准错误。

v1 使用长度前缀消息：

```text
4 字节 little-endian 长度
UTF-8 JSON payload
```

请求至少包含：

```json
{
  "version": 1,
  "kind": "expand_derive",
  "package": "display_macros",
  "macro": "Display",
  "input": [],
  "call_site": {}
}
```

响应至少包含：

```json
{
  "version": 1,
  "output": [],
  "diagnostics": []
}
```

令牌、分隔符、spacing 和 Span 都使用显式字段序列化。协议版本不匹配、帧长度非法、JSON 无法解析或响应不完整时，编译器终止当前宏调用并报告错误。

编译器为启动握手、单次展开和单帧大小设置有限制。具体数值属于编译器内部配置，不构成宏 API 承诺；测试可以使用更小的限制验证失败路径。

v1 一次只处理一个请求，不支持同一宏进程内的并发调用。编译结束后编译器发送关闭消息；宏进程无响应时由编译器终止。

## 展开语义

展开顺序为：

```text
源代码解析
  -> 收集 derive 属性
  -> 解析宏路径并定位导出函数
  -> 调用 host 宏执行器
  -> 验证并合并输出令牌
  -> 重新解析展开结果
  -> HIR
  -> 名称解析和类型检查
  -> MIR 和后端
```

对于：

```riddle
#[derive(A, B)]
struct User { ... }
```

规则为：

- 按 `A`、`B` 的声明顺序调用。
- 每个 derive 都接收同一个未修改的原始条目令牌。
- 原始条目始终保留。
- 每个宏的返回值必须是零个或多个顶层条目。
- 返回条目按 derive 顺序追加到原始条目之后。
- 返回值不能替换原条目。
- 生成结果中的 `derive` 不再次触发展开，避免递归。

`attributes(display)` 声明 derive 宏允许使用的辅助属性。辅助属性作为输入令牌传递给宏；未被任何声明注册的辅助属性报告编译错误。

编译器不会把宏结果简单当成最终字符串。宏结果先转换为带源映射的虚拟展开源，再使用现有解析器重新解析，从而继续复用现有 AST、HIR 和诊断逻辑。

## 诊断和失败处理

`Diagnostic` 至少包含严重级别、Span 和消息。支持错误、警告和说明三种级别。

宏可以通过以下形式报告错误：

```riddle
Diagnostic::error(span, "unsupported item").emit();
TokenStream::new()
```

处理规则：

- 出现错误级 Diagnostic 时，忽略该调用的输出并使当前编译失败。
- 警告和说明保留到编译器诊断流。
- 宏函数 panic、host 进程崩溃、超时、非零异常退出或 IPC 失败，都转换成编译错误。
- 宏主动发出的诊断使用宏传回的 Span。
- 生成代码的语法或类型错误使用生成令牌的 Span。
- host 级失败定位到 derive 属性调用处。

## 安全边界

宏是受信任的编译期代码。v1 不提供沙箱，宏可以使用 host 进程拥有的文件、环境变量和进程权限。

独立进程的目的不是建立安全边界，而是隔离崩溃、控制超时、限制协议输出并让编译器可以回收失败的宏执行器。

## 测试和验收

测试分为四层：

1. API 单元测试：令牌构造、分组、spacing、Span 和 Diagnostic。
2. 协议单元测试：帧编解码、版本检查、非法长度、损坏 JSON 和不完整响应。
3. 编译器集成测试：宏包构建、derive 解析、输出重解析、HIR/类型检查和诊断映射。
4. 端到端测试：独立宏包和使用方程序完成构建并运行生成代码。

必须覆盖以下行为：

- derive 生成 `impl` 并被目标程序使用。
- 多个 derive 的顺序和原始条目保留。
- 辅助属性传递和未知辅助属性报错。
- 泛型条目和嵌套 token group。
- 未知宏、非法输出和输出无法重新解析。
- 宏错误、panic、崩溃、超时和协议损坏。
- host/target 依赖分离。
- 生成的 derive 不递归展开。
- 宏执行器在同一编译中被复用。

## 验收条件

设计实现完成后，以下条件必须同时成立：

- 普通库和二进制包现有编译行为不变。
- 过程宏包能在 host 平台构建并被目标包调用。
- 生成代码进入现有 HIR、类型检查、MIR 和 C 后端。
- 宏错误不会导致编译器无诊断退出。
- host/target 依赖不会互相污染。
- 所有新增失败路径都有可定位的编译诊断。

## 后续扩展方向

后续可以在不改变 v1 derive 接口的前提下增加：

- 导入后使用未限定宏名。
- attribute macro 和 function-like macro。
- 更完整的 Span hygiene。
- 结构化 AST/解析辅助库。
- 持久化展开缓存。
- 可选的宏权限或沙箱机制。

这些扩展不属于 v1 实现范围。
