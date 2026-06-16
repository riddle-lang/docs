# impl 块

`impl` 用来为类型实现函数和 trait。
Riddle 的 `impl` 设计借鉴 Rust，但做了一个重要改进：一个 `impl` 块可以同时实现多个 trait，从而减少代码分散。

## 为类型实现自己的函数

如果只想给类型添加自己的函数，可以写：

```riddle
impl Foo {
    fn help() -> str {
        "HELP"
    }
}
```

这种写法表示这些函数属于 `Foo` 本身，而不是某个外部 trait 的要求。

## 使用 Self 标记自身函数

你也可以在 trait 列表里写 `Self`：

```riddle
impl Self for Foo {
    fn help() -> str {
        "HELP"
    }
}
```

`Self` 不是必须的。它的作用是明确表示：这个 `impl` 块里包含为类型自己实现的函数。

## 同时实现多个 trait

Riddle 支持在一个 `impl` 块中同时实现多个 trait：

```riddle
trait Bar {
    fn bar();
}

trait DebugLike {
    fn debug() -> str;
}

impl Self, Bar, DebugLike for Foo {
    fn bar() {
    }

    fn debug() -> str {
        "Foo"
    }

    fn help() -> str {
        "HELP"
    }
}
```

这比为每个 trait 都写一个独立 `impl` 更集中。对于一个类型的核心能力，你可以把它们放在一个地方阅读。

## 为什么这样设计

Rust 的 trait 系统很强大，但当一个类型实现很多 trait 时，代码可能被拆成很多 `impl` 块。
这种拆分有时有帮助，但也可能让读者在文件里来回跳转。

Riddle 允许把相关实现放在一起：

```riddle
impl Self, Read, Write for File {
    fn read() {
    }

    fn write() {
    }

    fn close() {
    }
}
```

如果你希望分开组织，也可以继续写多个 `impl` 块。Riddle 提供的是选择，而不是强迫所有实现必须集中。

## 小结

- `impl Foo` 为类型实现自己的函数；
- `impl Self for Foo` 可以显式标记自身函数实现；
- `impl Self, Bar for Foo` 可以同时写自身函数和 trait 实现；
- 一个 `impl` 块可以实现多个 trait；
- 这种设计减少了代码分散，让相关实现更容易放在一起阅读。
