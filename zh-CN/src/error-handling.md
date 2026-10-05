# 错误处理

Riddle 没有异常。可恢复的失败用 `Option` 和 `Result` 表达，不可恢复的路径用 `panic` 终止进程。三个类型都在 prelude 里，不需要导入。

## Option

`Option<T>` 表示「可能有值」：

```riddle
fun find_first_even(values: &[i32]) -> Option<i32> {
    for value in values {
        if value % 2 == 0 {
            return Some(*value);
        }
    }
    None
}

fun main() {
    match find_first_even(&[1, 3, 4, 5]) {
        Some(value) => println!("{}", value),
        None => println!("none"),
    }
}
```

方法有 `is_some`、`is_none`、`unwrap`、`expect`、`unwrap_or`、`unwrap_or_else`、`map`、`map_or`、`and`、`and_then`、`or`、`or_else`。没有 `ok_or`、`filter`、`take`、`as_ref`。

`unwrap` 和 `expect` 在 `None` 上调用会 panic：

```riddle
fun main() {
    let value: Option<i32> = None;
    println!("{}", value.unwrap_or(0)); // 0
    println!("{}", value.unwrap());     // panic
}
```

## Result

`Result<T, E>` 区分成功与失败，`E` 由你决定：

```riddle
fun parse_positive(text: &str) -> Result<i32, &str> {
    match std::parse::parse_i32(text) {
        Ok(value) => {
            if value > 0 {
                Ok(value)
            } else {
                Err("not positive")
            }
        }
        Err(_) => Err("not a number"),
    }
}

fun main() {
    match parse_positive("42") {
        Ok(value) => println!("{}", value),
        Err(reason) => println!("{}", reason),
    }
}
```

方法有 `is_ok`、`is_err`、`unwrap`、`expect`、`unwrap_or`、`unwrap_or_else`、`map`、`map_err`、`map_or`、`and`、`and_then`、`ok`、`err`。

## 用 ? 传播

`?` 在失败时提前返回：操作数是 `Option` 就返回 `None`，是 `Result` 就返回 `Err`。

```riddle
fun half(n: i32) -> Result<i32, &str> {
    if n % 2 == 0 {
        Ok(n / 2)
    } else {
        Err("odd")
    }
}

fun twice(n: i32) -> Result<i32, &str> {
    let h = half(n)?;
    Ok(h * 2)
}

fun main() {
    match twice(8) {
        Ok(value) => println!("{}", value),
        Err(reason) => println!("{}", reason),
    }
}
```

约束有三条：

- 操作数必须是 `Option` 或 `Result`，其他类型报 `E0061`；
- 在返回 `Option` 的函数里才能对 `Option` 用 `?`，否则报 `E0062`；对 `Result` 用 `?` 时，外层返回类型必须是同一个 `Result` 枚举；
- `Result` 的错误类型要能转成外层错误类型，先找 `Into::into` 再找 `From::from`，都找不到报 `E0063`。

`?` 不是 trait 驱动的，没有 `Try`，也不能用在类型别名或包装类型上。

## panic 与断言

`panic!` 打印消息和源码位置，然后终止进程；它不做栈展开，也没有捕获机制：

```riddle
fun main() {
    let limit = 3;
    if limit > 2 {
        panic!("limit {} is too large", limit);
    }
}
```

`assert!`、`assert_eq!`、`assert_ne!` 以及对应的 `debug_assert*` 在条件不成立时 panic；`todo!`、`unimplemented!`、`unreachable!` 用固定消息 panic。它们都返回 `!`，可以放在需要其他类型的位置：

```riddle
fun require_positive(value: i32) -> i32 {
    if value > 0 {
        value
    } else {
        unreachable!("checked by the caller")
    }
}

fun main() {
    assert_eq!(require_positive(2), 2);
    println!("ok");
}
```

`panic` 之后的退出码在 Windows 上是 3，其它平台是 134；`riddle run` 与编译产物一致。

`Option` 和 `Result` 在元素是 `Copy` 时也是 `Copy`，可以像普通值一样传递。它们没有 `Clone` 和 `PartialEq` 实现，比较内容要显式 `match`。
