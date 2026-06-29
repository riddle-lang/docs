# 模块、use 与枚举

Riddle 已经支持用模块组织名字，用 `use` 引入路径，以及用 `enum` 表达多种可能的数据形状。

## 模块

内联模块使用 `mod name { ... }`：

```riddle
mod math {
    struct Number {
        value: i32,
    }

    fun one() -> Number {
        Number { value: 1 }
    }
}
```

模块中的名字可以通过路径访问：

```riddle
fun main() -> i32 {
    let n = math::one();
    n.value
}
```

解析路径时可以使用 `self`、`super`、`crate` 和以 `::` 开头的绝对路径。`mod name;` 的语法也可以被解析，但当前文档示例优先使用内联模块。

## use

`use` 可以把路径引入当前作用域：

```riddle
use crate::math::Number;

fun make() -> Number {
    Number { value: 1 }
}
```

也可以使用别名、glob 和列表：

```riddle
use crate::math::Number as Num;
use crate::math::*;
use crate::{math::Number, util::helper as help};
```

名字解析会处理局部变量、参数、模块项、结构体、枚举变体、函数和 impl 方法。

## 枚举

枚举用 `enum` 定义。变体可以没有字段，也可以使用元组或结构体形式：

```riddle
enum Message {
    Quit,
    Move(i32, i32),
    Write { text: &str },
}
```

枚举可以带类型参数：

```riddle
enum Maybe<T> {
    None,
    Some(T),
}
```

当前类型系统能识别枚举类型和变体路径，`match` 可以使用枚举变体模式：

```riddle
fun unwrap_or_zero(value: Maybe<i32>) -> i32 {
    match value {
        Maybe::Some(n) => n,
        Maybe::None => 0,
    }
}
```

## 小结

- `mod name { ... }` 定义内联模块；
- `use` 支持简单导入、别名、glob 和列表；
- 路径支持 `self`、`super`、`crate` 和 `::`；
- `enum` 支持 unit、tuple 和 struct 变体；
- 枚举和结构体一样可以带简单类型参数。
