# 你好，Riddle

## 创建项目

```bash
clue new hello
cd hello
```

目标目录不存在时 `clue new` 会建好一个可构建的包，终端里只打印一行：

```text
clue: created hello
```

生成的文件如下。`.gitignore` 里只有一行 `/.clue`，把构建目录挡在版本控制之外。

```text
hello/
  .gitignore
  Clue.toml
  src/
    main.rid
```

`Clue.toml` 声明包名、版本、二进制目标，并留出一个空的依赖表：

```toml
[package]
name = "hello"
version = "0.1.0"

[[bin]]
name = "hello"
path = "src/main.rid"

[dependencies]
```

初始的 `src/main.rid` 只有一个空函数：

```riddle
fun main() {
}
```

## 写第一个程序

把 `src/main.rid` 整个替换成：

```riddle
struct Point {
    x: i32,
    y: i32,
}

fun distance_squared(point: Point) -> i32 {
    point.x * point.x + point.y * point.y
}

fun main() {
    let point = Point { x: 3, y: 4 };
    let value = distance_squared(point);
    println!("distance squared = {}", value);
}
```

## 检查并运行

在项目目录里执行 `clue check`，通过后打印一行 `clue: checked` 和入口文件的绝对路径。接着 `clue run` 完成构建、启动程序：

```text
> clue check
clue: checked <项目>/src/main.rid

> clue run
clue: built <项目>/.clue/build/hello.exe
distance squared = 25
```

第二次运行不会重新编译，同样的位置换成 `clue: fresh <项目>/.clue/build/hello.exe`。程序自己的退出码原样传给 shell。

`clue run` 需要机器上能编 C11 的编译器；没有的话换用解释器，输出相同，也不需要构建目录：

```text
> riddle run src/main.rid
distance squared = 25
```

解释器不生成可执行文件也不缓存结果，适合反复试代码；装 C 工具链的过程见[安装工具链](./install.md)。清单字段、依赖和各平台产物路径集中在[项目、依赖与构建](./clue-create.md)。

## 这段代码做了什么

`struct Point` 声明两个 `i32` 字段；`Point { x: 3, y: 4 }` 按字段名构造值，字段顺序可以换。`fun` 声明函数，参数写成 `名称: 类型`，返回类型跟在 `->` 后面。`distance_squared` 的函数体只有一个表达式，末尾没有分号，它就充当返回值。

`let` 建立绑定，默认不可变；`println!` 是内置宏，`{}` 按 `Display` 格式化后面的实参。

`Point` 不是 `Copy` 类型，把 `point` 传给 `distance_squared` 是一次移动，调用之后原绑定不能再读。写成下面这样，`clue check` 会在运行前拦下来：

```riddle
struct Point {
    x: i32,
    y: i32,
}

fun distance_squared(point: Point) -> i32 {
    point.x * point.x + point.y * point.y
}

fun main() {
    let point = Point { x: 3, y: 4 };
    let value = distance_squared(point);
    println!("distance squared = {}", point.x); // E0100
}
```

诊断带的 note 给出了替代做法：需要保留原值就借出去。完整规则见[移动语义](./move-semantics.md)。

## 诊断长什么样

`clue check` 和 `clue run` 都把诊断写到 stderr，并以退出码 1 结束。上面那段代码的完整输出是：

```text
error[E0100]: use of moved field: `x`
 --> src/main.rid:13:5
   |
12 |     let value = distance_squared(point);
   |                                  ----- value moved here
13 |     println!("distance squared = {}", point.x);
   |     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = note: borrow with `&` if the original value must remain usable

error: aborting due to 1 previous error
Error: check failed
```

`clue check` 只跑前端分析，不调用 C 编译器，因此遇到错误时最后一行是 `Error: check failed`；`clue run` 会在打印同样的诊断后以 `Error: build failed` 结束。
