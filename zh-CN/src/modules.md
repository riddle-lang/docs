# 模块、use 与包

模块负责组织名字和可见性，`use` 负责把路径引入当前作用域，Clue 的包依赖则构成项目之间的边界。枚举已经拆到[枚举、模式与 match](./enums-and-patterns.md)。

## 内联模块

使用 `mod name { ... }` 定义内联模块：

```riddle
mod math {
    pub fun one() -> i32 {
        1
    }
}

fun main() -> i32 {
    math::one()
}
```

模块中的项默认私有。只有 `pub` 项能从模块外通过路径访问。`pub` 也可以用于结构体字段、结构体、枚举、trait、const、type alias 和 `use`。

## 文件模块

通过 `riddlec` 或 Clue 从文件加载源码时，可以声明外部模块：

```riddle
mod math;
pub mod util;
```

编译器会在当前模块目录下寻找 `name.rid` 或 `name/mod.rid`，两者同时存在会报错。模块不会仅因为文件存在就自动加入编译，父模块必须写出对应的 `mod` 声明。

目录按层级推进。`src/main.rid` 中的 `mod foo;` 会读取 `src/foo.rid` 或 `src/foo/mod.rid`；进入 `foo` 后，其中的 `mod bar;` 会继续读取 `src/foo/bar.rid` 或 `src/foo/bar/mod.rid`。

路径可以使用 `self`、`super`、`crate` 和以 `::` 开头的绝对形式。

## use 与重新导出

`use` 可以导入普通路径、别名、glob 或列表：

```riddle
use crate::math::one;
use crate::math::one as one_value;
use crate::math::*;
use crate::{math::one, util::helper as help};
```

`pub use` 会重新导出名字，可用于隐藏内部模块结构：

```riddle
mod math {
    mod inner {
        pub fun one() -> i32 { 1 }
    }

    pub use self::inner::one;
}
```

过程宏也使用独立宏命名空间中的 `use`，支持分组、别名、glob、混合导入和通过模块 `pub use` 重新导出。具体清单与示例见[Clue 构建器](./clue.md#过程宏)。

## 包依赖也是模块

Clue 的本地 path 依赖会以依赖键作为当前包中的模块名：

```toml
[dependencies]
math = { path = "../math" }
```

当前包可以访问依赖公开导出的项：

```riddle
fun main() -> i32 {
    math::one()
}
```

依赖键与真实包名不同时，使用 Cargo 风格的 `package` 字段：

```toml
[dependencies]
math = { package = "math-core", path = "../math-core" }
```

Clue 当前只支持本地 path 依赖，不支持 registry、版本求解、git 依赖或 lockfile。完整项目布局和入口规则见[创建与构建项目](./clue-create.md)。
