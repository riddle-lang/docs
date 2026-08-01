# 错误处理

Riddle 区分“值可能不存在”“操作可能失败”和“程序无法继续”三种情况，分别使用 `Option<T>`、`Result<T, E>` 和 `panic`。

## Option 表示可能没有值

`Option<T>` 有 `Some(T)` 与 `None` 两个变体。标准库的 `parse_i32` 用它表示十进制文本是否能解析成整数：

```riddle
use std::parse::parse_i32;

fun read_or_zero(text: &str) -> i32 {
    match parse_i32(text) {
        Some(value) => value,
        None => 0,
    }
}
```

只需要一个后备值时，可以使用 `unwrap_or`：

```riddle
let value = parse_i32("42").unwrap_or(0);
```

Riddle 当前没有 Kotlin 式 `T?` 和 `null`。普通缺失值应建模为 `Option`。

## Result 表示成功或失败

`Result<T, E>` 的 `Ok(T)` 携带成功值，`Err(E)` 携带错误：

```riddle
use std::parse::parse_i32;

fun parse_positive(text: &str) -> Result<i32, &str> {
    match parse_i32(text) {
        Some(value) => if value < 0 {
            Err("expected a non-negative integer")
        } else {
            Ok(value)
        },
        None => Err("not an integer"),
    }
}
```

`Result` 提供 `is_ok`、`is_err`、`unwrap_or`、`ok` 和 `err`。需要保留错误内容或执行不同恢复逻辑时，优先使用 `match`，不要立即丢弃 `Err`。

Riddle 当前的 `return` 是语句，不能像 Rust 那样直接写成 `None => return Err(...)`；让整个 `match` 产生 `Result` 即可。

## 使用问号传播错误

后缀 `?` 会在 `Ok` 时取出成功值，在 `Err` 时提前返回：

```riddle
fun double_positive(text: &str) -> Result<i32, &str> {
    let value = parse_positive(text)?;
    Ok(value * 2)
}
```

`?` 只能用于 `Result<T, E>`，所在函数也必须返回 `Result`。错误类型相同时会直接传播；不同时，编译器要求操作数的错误类型通过 `Into` 转换为外层错误类型。相关诊断是 `E0061`、`E0062` 和 `E0063`。

## panic 用于不可恢复路径

`panic(message)` 返回 never 类型 `!`，因此可以出现在需要任意结果类型的分支：

```riddle
fun require(valid: bool) -> i32 {
    if valid { 42 } else { panic("invalid state") }
}
```

当前标准库实现直接调用 C `abort()`，不会输出传入的消息，也不能恢复。输入错误、文件错误或其他预期失败应使用 `Option` 或 `Result`，不要用 `panic` 代替普通错误处理。
