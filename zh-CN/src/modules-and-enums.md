# 模块、use 与枚举

Riddle 已经支持用模块组织名字，用 `use` 引入路径，以及用 `enum` 表达多种可能的数据形状。

## 模块

内联模块使用 `mod name { ... }`：

```riddle
mod math {
    pub fun one() -> i32 {
        1
    }
}
```

模块中的名字可以通过路径访问：

```riddle
fun main() -> i32 {
    math::one()
}
```

通过 `riddlec` 或 `clue` 从文件加载源码时，也可以使用外部模块声明：

```riddle
mod math;
pub mod util;
```

编译器会按顺序寻找同目录下的 `name.rid` 和 `name/mod.rid`，并把外部模块展开成内联模块。`pub mod name;` 展开后会保留 `pub`。

解析路径时可以使用 `self`、`super`、`crate` 和以 `::` 开头的绝对路径。

## 可见性

模块里的项默认是私有的。通过模块路径从外部访问时，只能访问 `pub` 项：

```riddle
mod math {
    fun hidden() -> i32 {
        0
    }

    pub fun one() -> i32 {
        1
    }
}

fun main() -> i32 {
    math::one()
}
```

`pub` 当前可用于函数、结构体、枚举、trait、const、type alias、模块和 `use`。结构体字段的 `pub` 语法已经会被解析，但字段级可见性检查还没有完整实现。

## use

`use` 可以把路径引入当前作用域：

```riddle
use crate::math::one;

fun main() -> i32 {
    one()
}
```

也可以使用别名、glob 和列表：

```riddle
use crate::math::one as one_value;
use crate::math::*;
use crate::{math::one, util::helper as help};
```

`pub use` 会把导入的名字重新导出，适合隐藏内部模块结构：

```riddle
mod math {
    mod inner {
        pub fun one() -> i32 {
            1
        }
    }

    pub use self::inner::one;
}

fun main() -> i32 {
    math::one()
}
```

名字解析会处理局部变量、参数、模块项、结构体、枚举变体、函数和 impl 方法。

## 包依赖也是模块

Clue 的本地 path 依赖会作为模块注入当前包：

```toml
[dependencies]
math = { path = "../math" }
```

当前包可以用依赖键访问依赖包导出的 `pub` 项：

```riddle
fun main() -> i32 {
    math::one()
}
```

如果依赖包的真实包名不适合作为模块名，可以用 Cargo 风格的 `package` 字段：

```toml
[dependencies]
math = { package = "math-core", path = "../math-core" }
```

完整的项目布局和入口规则见 [Clue 构建器](./clue.md)。

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
enum Option<T> {
    None,
    Some(T),
}
```

当前类型系统能识别枚举类型和变体路径，`match` 可以使用枚举变体模式：

```riddle
fun unwrap_or_zero(value: Option<i32>) -> i32 {
    match value {
        Option::Some(n) => n,
        Option::None => 0,
    }
}
```

## 小结

- `mod name { ... }` 定义内联模块；
- `mod name;` 会从 `name.rid` 或 `name/mod.rid` 展开外部模块；
- 模块项默认私有，跨模块路径只导出 `pub` 项；
- `use` 支持简单导入、别名、glob、列表和 `pub use` 重新导出；
- Clue 的本地 path 依赖会作为模块注入当前包；
- 路径支持 `self`、`super`、`crate` 和 `::`；
- `enum` 支持 unit、tuple 和 struct 变体；
- 枚举和结构体一样可以带简单类型参数。
