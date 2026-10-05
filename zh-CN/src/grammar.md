# 形式化语法

下面按解析器的分派顺序列出当前接受的形状，顺序与 `crates/frontend/src/parser.rs` 一致。记法：`"..."` 是字面 token，`?` 可选，`*` 零或多次，`+` 一次或多次，`|` 选择，`(...)` 分组，裸名字是规则名。本页只描述形状，不描述名字解析和类型规则。

## 词法

关键字 34 个：

```text
let fun struct if else while loop break continue return as self mod use mut move pub
super crate enum trait impl dyn match const type extern unsafe safe for in where true false
```

大写 `Self` 不是关键字。它在每个 `impl` 作用域里指向正在实现的那个类型，返回类型、参数、类型实参位置都有效（`fun zero() -> Self`、`fun combine(self, other: Self)`、`Vector<Self>`），trait 定义与 trait 实现里也是同一个写法。构造仍然要写具体结构体名：`Self { x: 1 }` 报 `E0050`。

标识符是 `[a-zA-Z][a-zA-Z0-9_]*` 或 `_[a-zA-Z0-9_]+`。单独的 `_` 是另一个 token，不能当表达式：`_ = a;` 报 `expected statement or expression, found Underscore`。关键字不能当标识符、字段名或参数名：`fun f(type: i32)` 报 `expected Ident, found TypeKw`。

注释四种，全是 trivia，可以出现在任何两个 token 之间：

| 写法 | 形式 |
| --- | --- |
| `//...` | 行注释 |
| `///...`、`//!...` | 行文档注释 |
| `/*...*/` | 块注释 |
| `/**...*/`、`/*!...*/` | 块文档注释 |

块注释可以嵌套。`/**/` 不是空块注释：`/**` 先被当成块文档注释的开头，剩余输入里再找不到 `*/`，于是整段变成未闭合注释并报 `unterminated block comment`；空块注释要写 `/* */`。

字面量：

```text
literal    = int_lit | float_lit | string_lit | raw_string | char_lit | "true" | "false"

int_lit    = dec_lit | hex_lit | oct_lit | bin_lit
dec_lit    = [0-9] [0-9_]*
hex_lit    = "0x" "_"* [0-9a-fA-F] [0-9a-fA-F_]*
oct_lit    = "0o" "_"* [0-7] [0-7_]*
bin_lit    = "0b" "_"* [01] [01_]*
int_suffix = "i8" | "i16" | "i32" | "i64" | "i128" | "isize"
           | "u8" | "u16" | "u32" | "u64" | "u128" | "usize"

float_lit  = [0-9]+ "." [0-9]+ ([eE] [+-]? [0-9]+)? float_suffix?
           | [0-9]+ [eE] [+-]? [0-9]+ float_suffix?
           | [0-9]+ float_suffix
float_suffix = "f16" | "f32" | "f64" | "f128"

string_lit = '"' ( [^"\\] | "\\" any )* '"'
raw_string = "r" "#"* '"' ... '"' "#"*
char_lit   = "'" ( [^'\\] | "\\" any ) "'"
```

- `_` 可以出现在数字之间或末尾：`1_000u64`、`0x_FF`。
- `i128`、`u128`、`f16`、`f128` 词法接受，但类型系统里没有这些类型，用到就报 `E0011`。
- `1.` 不是浮点字面量：`let x = 1.;` 被读成字段访问，报 `expected Ident, found Semi`。
- 普通字符串可以跨行。转义只处理 `\n` `\r` `\t` `\0` `\\` `\"` `\'`，其它 `\X` 原样留下 `X`，所以 `"\x41"` 的值是 `x41`；没有 `\xHH`，也没有 `\u{...}`。
- `b"..."` 字节串和 `r#ident` 裸标识符都不存在：`b"x"` 被读成标识符 `b` 加一个字符串。

标点和运算符 token 全集：

```text
-> == != <= >= && || => += -= *= /= %= &= |= ^= <<= >>= << >> + - * / % & | ^ < > ! ? #
( ) { } [ ] . .. ..= : :: ; , =
```

没有 `@`、`~`、`$`、`...`，也没有生命周期：`'a` 报 `unrecognized character`。

## 顶层与条目

文件内容是 `statement*`。每个 `statement` 先吃掉属性，再按第一个 token 分派：

```text
"pub"             -> pub_item
"let"             -> var_decl
"fun" "("         -> 表达式语句（已移除的匿名函数）
"fun"             -> func_decl
"unsafe" "fun"    -> func_decl
"unsafe" "extern" -> extern_decl
"struct"          -> struct_decl
"mod"             -> mod_decl
"use"             -> use_decl
"enum"            -> enum_decl
"trait"           -> trait_decl
"impl"            -> impl_decl
"const"           -> const_decl
"type"            -> type_alias_decl
"break"           -> break_stmt
"continue"        -> continue_stmt
"return"          -> return_stmt
"extern"          -> extern_decl
其它               -> 表达式语句
```

`pub_item` 是下列条目加 `pub` 前缀：

```text
pub_item = "pub" ( func_decl
                 | "unsafe" ( func_decl | extern_decl )
                 | struct_decl | mod_decl | use_decl | enum_decl | trait_decl
                 | const_decl | type_alias_decl | extern_decl ) ;
```

`pub impl S {}` 报 `expected item after 'pub', found Impl`。

块体与文件顶层用同一条 `statement` 规则：

```text
program = statement* ;
block   = "{" statement* expression? "}" ;
```

条目后面不能再写分号：`fun f() {};` 报 `expected expression, found Semi`。

## 属性

```text
attribute = "#" "[" balanced_token* "]" ;
```

`#` 必须紧跟 `[`，内部只做括号配平，不按语法解析。能写属性的位置：语句前、参数前、struct 字段、enum 变体、trait 条目、impl 条目、`extern`、match 臂、表达式、类型、模式、字段模式。

```riddle
struct S {
    #[field]
    x: i32,
}

#[derive(Debug, Clone)]
struct T {
    y: i32,
}

#[item]
fun make(#[param] v: i32) -> #[ret] S {
    S { x: v }
}

fun main() {
    let #[pat] s = make(1);
    println!("{} {:?}", s.x, T { y: 2 });
}
```

只有 `#[lang = "..."]`、`#[fundamental]` 和 `#[derive(...)]` 会被处理，其余属性不报错也不生效，只作为元数据保留。同一个类型上写了 `#[derive(...)]` 时，字段上的未知属性会被当成 derive 辅助属性，报 `E0400`。内部属性 `#![...]` 不支持：写在文件开头报 `expected expression, found Hash`。

## 模块、use 与路径

```text
mod_decl = "pub"? "mod" ident ( ";" | "{" statement* "}" ) ;
use_decl = "pub"? "use" use_tree ";" ;
use_tree = "{" use_tree ( "," use_tree )* ","? "}"
         | path ( "as" ident
                | "::" "*"
                | "::" "{" use_tree ( "," use_tree )* ","? "}" )? ;
path = "::"? path_segment ( "::" path_segment )* ;
path_segment = ( ident | "self" | "super" | "crate" ) ( "::" type_arg_list )? ;
```

`use` 树支持 `as` 别名、`::*`、可嵌套的 `::{...}`、尾逗号、前导 `::`，以及 `self`/`super`/`crate` 段：`use std::io::{self, print};`、`use super::x;`、`use ::std::io::print;` 都合法。

路径段里的类型实参要写 `::<...>`。表达式位置更严：`Vec::<i32>::new()`、`g::<i32>(1)` 合法，写成 `g<i32>(1)` 报 `generic arguments in expression paths must use ::<...>`。

## let 绑定

```text
var_decl = "let" pattern ( ":" ty )? ( "=" expression ( "else" block )? )? ";" ;
```

初始化式可以省略。`let x: i32;` 是延迟初始化，赋值前使用报 `E0059`；类型和初始化式都省略时（`let x;`）编译器要从首次赋值推断类型，推断不出来报 `E0045`。

`else` 是 let-else，必须写在初始化式后面（`let x else { };` 报 let-else requires an initializer），后面必须是块，块必须发散，否则报 `E0066`。

`let` 只接受单个模式：写成 `let 1 | 2 = x;` 会得到「or-patterns are only allowed on match arms」的诊断。

## 函数与参数

```text
func_decl  = "pub"? "unsafe"? "fun" ident generic_params? param_list ( "->" ty )? where_clause? ( block | ";" ) ;
param_list = "(" ( param ( "," param )* ","? )? ")" ;
param      = attribute* ( "&" "mut"? "self" | "self" | "mut"? ident ":" ty ) ;
```

- 参数列表允许尾逗号（`fun f(a: i32,) {}`）；泛型参数表不允许（`fun f<T,>() {}` 报 `expected Ident, found Greater`）。
- receiver 有三种：`&self`、`&mut self`、按值的 `self`。普通参数必须写类型，缺了报 `expected parameter type`。
- 参数上的 `mut` 是绑定可变性，不是类型的一部分：`fun f(mut x: i32) { x = 1; }` 合法。
- 函数体可以写成 `;`，但只有 `extern` 块里的声明允许这样：模块层的 `fun f();` 报 `E0015`（降级不会为它生成函数，调用只会在运行期失败）。
- 块内最后一个不带 `;` 的表达式就是块的值。

## 结构体

```text
struct_decl       = "pub"? "struct" ident generic_params? where_clause? struct_field_list ;
struct_field_list = "{" ( struct_field ( "," struct_field )* ","? )? "}" ;
struct_field      = attribute* "pub"? "mut"? ident ":" ty ;
```

字段列表不能省：`struct S(i32);` 报 `expected LBrace, found LParen`，`struct S;` 报 `expected LBrace, found Semi`。没有元组结构体和 unit 结构体。

字段修饰符顺序固定为 `pub` 在前、`mut` 在后：`pub mut x: i32` 合法，`mut pub x: i32` 报 `expected Ident, found Pub`。`mut` 字段表示内部可变性。

## 跳转与块

```text
return_stmt   = "return" expression? ";" ;
break_stmt    = "break" expression? ";" ;
continue_stmt = "continue" ";" ;
expr_stmt     = expression ";" | block_expression ";"? ;
```

`break` 带值只对 `loop` 有意义：`while` 或 `for` 里写 `break 1;` 报 `E0065`，循环外写报 `E0042`。

块状表达式（`{}`、`if`、`while`、`loop`、`for`、`match`、`unsafe`）在语句位置可以省略分号，其它表达式必须写分号。块状表达式在语句位置就结束该语句，紧跟的 `(` 不会粘成调用。

## 表达式

### 前缀、原子与后缀

```text
prefix_op  = "+" | "-" | "&" "mut"? | "&&" | "*" | "!" ;
postfix_op = "(" arg_list ")" | "." ( ident | number ) | "[" expression "]" | bracket_lambda | "?" ;
arg_list   = "(" ( expression ( "," expression )* ","? )? ")" ;

atom = literal
     | path
     | "(" ( expression ( "," expression )* ","? )? ")"
     | "[" "]" | "[" expression ( "," expression )* ","? "]"
     | "[" expression ";" expression "]"
     | "move"? "[" ( lambda_param ( "," lambda_param )* ","? )? "->" expression "]"
     | path ( "::" type_arg_list )? "{" ( field_init ( "," field_init )* ","? )? "}"
     | macro_call
     | block | if_expr | while_expr | loop_expr | for_expr | match_expr | unsafe_expr ;

lambda_param = pattern ( ":" ty )? ;
field_init   = ident ( ":" expression )? ;
```

- 结构体字面量只在左侧是路径时成立；没有函数式更新，`S { ..base }` 报 `expected Ident, found DotDot`。
- `[` 组内在嵌套深度 0 处出现 `->` 就按方括号 lambda 解析，否则按数组字面量。后缀位置的 `expr [ ... -> ... ]` 表示把该 lambda 当唯一实参调用 `expr`：`values.map [v -> v * 2]`。`it` 只是惯例名字，不是隐式参数。
- 匿名函数 `fun(x) { ... }` 已移除，写它会得到指向方括号 lambda 的诊断。

```riddle
fun apply(f: impl Fn(i32) -> i32, v: i32) -> i32 {
    f(v)
}

fun main() {
    let twice = [x -> x * 2];
    println!("{} {}", apply(twice, 3), apply([x -> x + 1], 3));
}
```

### 控制流表达式

```text
if_expr     = "if" condition block ( "else" ( if_expr | block ) )? ;
while_expr  = "while" condition block ;
loop_expr   = "loop" block ;
for_expr    = "for" pattern "in" expression block ;
condition   = expression_no_struct | "let" pattern "=" expression_no_struct ;
match_expr  = "match" expression_no_struct "{" ( match_arm ( "," match_arm )* ","? )? "}" ;
match_arm   = attribute* arm_pattern ( "if" expression )? "=>" expression ;
unsafe_expr = "unsafe" block ;
```

- `if`、`while`、`for`、`match` 的头部用 `expression_no_struct`，即禁掉结构体字面量的表达式，所以 `if Foo { }` 里的 `{` 属于块。
- `else` 后面只能是块或另一个 `if`；`if let ... if guard` 不是语法。
- match 臂体是块时尾逗号可省；`match x { }` 能解析，穷尽性由类型检查负责（不穷尽报 `E0039`）。
- `while`、`for` 和不带 `else` 的 `if` 的值类型是 `()`。

### 优先级与结合性

从松到紧：

| 运算 | 结合性 |
| --- | --- |
| `=` `+=` `-=` `*=` `/=` `%=` `&=` `\|=` `^=` `<<=` `>>=` | 右 |
| `..` `..=` | 左 |
| `\|\|` | 左 |
| `&&` | 左 |
| `==` `!=` | 左 |
| `<` `>` `<=` `>=` | 左 |
| `\|` | 左 |
| `^` | 左 |
| `&` | 左 |
| `<<` `>>` | 左 |
| `+` `-` | 左 |
| `*` `/` `%` | 左 |
| `as` | 左 |
| 前缀 `+` `-` `&` `&mut` `&&` `*` `!` | — |
| 后缀调用、`.`、索引、`?`、结构体字面量 | 左 |

解析器里的绑定力数值：赋值 1、区间 1、`||` 2、`&&` 4、相等 6、比较 8、`|` 10、`^` 12、`&` 14、移位 16、加减 18、乘除模 20、`as` 21、前缀 22、后缀与结构体字面量 23。

位运算分成四级，不是一级：`<<` `>>` 紧于 `&`，`&` 紧于 `^`，`^` 紧于 `|`，四者都紧于比较。

赋值右结合，所以 `a = b = 1;` 读成 `a = (b = 1)`，内层表达式的值是 `()`：

```riddle
fun main() {
    let mut a = 1;
    let mut b = 2;
    a = b = 1; // E0001
}
```

区间也是左结合：`a..b..c` 读成 `(a..b)..c`。区间两端都必须有操作数，`..5`、`a..`、`..` 都是语法错误。

中缀运算符右侧是完整表达式，不限于一元表达式，所以 `1 + if c { 2 } else { 3 }` 合法。块状表达式同样能当值用：

```riddle
fun main() {
    let a = 1 + 2 * 3;
    let b = (1 + 2) * 3;
    let c = 1 & 2 ^ 3 | 4;
    let d = { 1 };
    let e = if a == 7 { 2 } else { 3 };
    println!("{} {} {} {} {}", a, b, c, d, e);
}
```

`loop { break 1; }`、`match`、`unsafe { 1 }` 也都能直接产生值；不带 `else` 的 `if` 出现在值位置时报 `E0002`。

## 类型

```text
ty = attribute* ty_kind ;
ty_kind = "!"
        | "&" "mut"? ty
        | "&&" ty
        | "*" ( "const" | "mut" ) ty
        | "(" ( ty ( "," ty )* ","? )? ")"
        | "[" ty ( ";" expression )? "]"
        | number
        | "impl" bound
        | "dyn" bound
        | path ( "<" type_list ">" )?
        | macro_call ;
```

- `()` 既是 unit 值也是 unit 类型；`(T)` 就是 `T`，`(T,)` 是元组。`unit` 不是类型名。
- `&` 后面可以跟一层 `mut`；`&&mut T` 不接受（`&&` 只吃一层，后面直接要类型），而 `&&mut` 模式合法。
- 裸指针必须写 `*const T` 或 `*mut T`：`*i32` 报 `expected 'const' or 'mut' after '*' in pointer type`。
- 数组类型的长度按表达式解析，不限于字面量：`[i32; 4]`、`[u8; 2 + 2]`。裸整数字面量单独作类型（例如 `Array<i32, 4>` 里的 `4`）是 const 泛型实参。
- `impl` 和 `dyn` 后面只能跟一个 bound：`impl A + B`、`dyn A + B` 都报 `expected RParen, found Plus`。多 bound 只能出现在 `<T: A + B>`、超 trait 列表和 `where` 谓词里。
- 函数类型 `fun(i32) -> i32` 已移除，写它会得到改用 `impl Fn(i32) -> i32` 或显式 bound 的诊断。

## 宏调用

```text
macro_call = path "!" ( "(" balanced_token* ")" | "[" balanced_token* "]" | "{" balanced_token* "}" ) ;
```

内容按配平 token 吃掉，不按普通语法解析。内置宏由编译器在解析前按源码文本展开，所以宏参数不受上面这些规则约束；未定义的宏报 `E0400`。`macro_rules!` 不存在，`macro_rules! m { ... }` 报「expected a delimited token tree after !」。宏系统本身见[编写过程宏](./proc-macros.md)。

## 枚举

```text
enum_decl    = "pub"? "enum" ident generic_params? where_clause? "{" ( enum_variant ( "," enum_variant )* ","? )? "}" ;
enum_variant = attribute* ident ( "(" ( ty ( "," ty )* ","? )? ")" | struct_field_list )? ;
```

三种变体形态都支持：`A`、`A(i32, i32)`、`A { x: i32 }`。判别值不存在：`enum E { A = 1 }` 报 `expected RBrace, found Eq`。变体名上不能写 `pub`（报 `expected Ident, found Pub`）。tuple 变体的元素是类型，写 `mut` 报 `expected type, found Mut`；struct 变体的字段可以写 `pub`，写 `mut` 语法通过，类型检查报 `E0014`。

## trait

```text
trait_decl = "pub"? "trait" ident generic_params? ( ":" bound ( "+" bound )* )? "{" trait_item* "}" ;
trait_item = attribute* "pub"? ( func_decl | "type" ident ( "=" ty )? ";" ) ;
```

trait 里只有方法和关联类型。关联常量不存在：`trait T { const C: i32; }` 报 `expected trait item, found Const`。方法可以带默认体；关联类型两种形态都行（`type U;` 和 `type U = i32;`）。超 trait 用 `+` 分隔，不写尾逗号。

## impl

```text
impl_decl = attribute* "impl" generic_params? ty ( "for" ty )? where_clause? "{" impl_item* "}" ;
impl_item = attribute* "pub"? ( func_decl | "type" ident "=" ty ";" | const_decl ) ;
```

impl 条目是方法、类型别名和关联常量。类型别名必须写 `= Ty`（`type T;` 报 `expected Eq, found Semi`），常量必须写 `= 值`。`pub impl S {}` 不合法。可调用特质有专门语法：`Fn`、`FnMut`、`FnOnce` 后面直接跟括号参数列表，例如 `impl Fn(i32) -> i32 for S { fun call(&self, x: i32) -> i32 { x } }`。

```riddle
struct S {
    pub x: i32,
    mut y: i32,
}

impl S {
    const SCALE: i32 = 2;
    type Unit = i32;

    fun scaled(&self, dx: i32) -> i32 {
        (self.x + dx) * S::SCALE
    }
}

fun main() {
    let s = S { x: 1, y: 2 };
    println!("{} {}", s.scaled(1), s.y);
}
```

## 常量与类型别名

```text
const_decl      = "pub"? "const" ident ":" ty "=" expression ";" ;
type_alias_decl = "pub"? "type" ident ( "=" ty )? ";" ;
```

模块和 impl 里的类型别名必须写 `= Ty`；trait 里 `type X;` 与 `type X = Ty;` 都能写。类型别名不能带泛型参数：`type Foo<T> = i32;` 报 `expected Eq, found Less`。

`const` 的初始化式必须是常量表达式，用结构体字面量初始化报 `E0060`。

## 泛型参数、bound 与 where

```text
generic_params  = "<" generic_param ( "," generic_param )* ">" ;
generic_param   = ident ( ":" bound ( "+" bound )* )? ( "=" ty )?
                | "const" ident ":" ty ;
bound           = path ( "(" type_list ")" "->" ty
                       | "<" ( bound_arg ( "," bound_arg )* ","? )? ">" )? ;
bound_arg       = ident "=" ty | ty ;
where_clause    = "where" where_predicate ( "," where_predicate )* ","? ;
where_predicate = ty ":" bound ( "+" bound )* ;
type_list       = ty ( "," ty )* ","? ;
type_arg_list   = "<" ( type_list )? ">" ;
```

- 默认类型实参只允许出现在 struct、enum、trait 的声明里；函数和 impl 不允许，`fun f<T = i32>() {}` 报 `expected Greater, found Eq`。
- 泛型参数表不写尾逗号；`where` 谓词可以写尾逗号。
- bound 可以是路径、带实参的路径，或者 `Fn(...) -> T` 形式的可调用特质；关联类型绑定写在实参里，例如 `dyn Iterator<Item = i32>`。
- 类型实参里的 `>>` 会拆成两个 `>`，所以 `Vec<Vec<i32>>` 不用加空格。

## extern 与 ABI 声明

```text
extern_decl     = attribute* "pub"? "unsafe"? "extern" string ( "{" extern_func_sig* "}" | func_decl ) ;
extern_func_sig = attribute* "pub"? ( "safe" | "unsafe" )? "fun" ident param_list ( "->" ty )? where_clause? ";" ;
```

- ABI 字符串必填：`unsafe extern { fun f(); }` 报 `expected String, found LBrace`。
- 块形式必须写 `unsafe extern`：`extern "C" { fun f(); }` 报 `extern blocks must use unsafe extern`。
- 单函数形式必须带函数体：`unsafe extern "C" fun f();` 报 single-function extern declarations are not supported。
- 块里每个函数可以写 `safe` 或 `unsafe`；`safe` 只在这里合法，写成 `safe fun f() {}` 报 `expected expression, found Safe`。
- 签名不能带泛型参数。

## 模式

```text
arm_pattern = "|"? pattern ( "|" pattern )* ;
pattern     = attribute* pattern_kind ;
pattern_kind = "mut" ident
             | "&" "mut"? pattern
             | "&&" "mut"? pattern
             | "_"
             | literal
             | "(" ( pattern ( "," pattern )* ","? )? ")"
             | path ( "!" balanced_token*
                    | "(" ( pattern ( "," pattern )* ","? )? ")"
                    | "{" ( field_pattern ( "," field_pattern )* ","? )? "}" )? ;
field_pattern = attribute* ident ( ":" pattern )? ;
```

- `mut` 只能直接跟标识符：`mut x` 是绑定模式，`mut (a, b)` 不是模式。
- 裸路径 `x` 落成绑定；`E::A`、`Some(x)`、`P { x, y }` 都是路径模式。
- `A | B` 只在 match 臂顶层：`let 1 | 2 = x;` 有专门诊断，`if let A | B = v` 是语法错误。
- 字面量模式不能带负号：`-1` 报 `expected pattern, found Minus`。
- 不存在 `ref`/`ref mut`、`@` 绑定、切片模式 `[a, b]`、区间模式 `1..=5`、嵌套 or-pattern `Some(1 | 2)`。

```riddle
struct P {
    x: i32,
    y: i32,
}

fun classify(n: i32) -> i32 {
    match n {
        1 | 2 => 10,
        n if n > 10 => 20,
        _ => 30,
    }
}

fun main() {
    let p = P { x: 1, y: 2 };
    let P { x, y } = p;
    println!("{} {} {}", classify(x + y), x, y);
}
```

## 当前不存在的形式

| 写法 | 结果 |
| --- | --- |
| `macro_rules!` | 报「expected a delimited token tree after !」；只有 `path!(...)` 形式的调用 |
| 生命周期标注 | `'a` 报 `unrecognized character`，源码里没有生命周期语法 |
| 函数类型 `fun(i32) -> i32` | 已移除，诊断指向 `impl Fn(i32) -> i32` |
| 开区间 `..x`、`x..`、`..` | 报 `expected expression, found DotDot` 或 `found Semi` |
| trait 里的关联 const | 报 `expected trait item, found Const`；impl 里可以写 |
| 循环标签 `'a: loop {}` | `'` 是非法字符 |
| 元组结构体、unit 结构体 | `struct S(i32);` 报 `expected LBrace, found LParen`，`struct S;` 报 `found Semi` |
| enum 判别值 `A = 1` | 报 `expected RBrace, found Eq` |
| `dyn A + B`、`impl A + B` | 报 `expected RParen, found Plus` |
| 内部属性 `#![...]` | 报 `expected expression, found Hash` |
| 闭包 `\|x\| x + 1` | 报 `expected expression, found Pipe`；用 `[x -> x + 1]` |
| 匿名函数 `fun(x) { ... }` | 已移除，诊断指向方括号 lambda |
| 结构体更新 `S { ..base }` | 报 `expected Ident, found DotDot` |
| 字节串、裸标识符、`\xHH`、`\u{...}` | `b"..."` 与 `r#ident` 不成立，`\u{...}` 是非法字符 |
| 空块注释 `/**/` | 报 `unterminated block comment`，用 `/* */` |
| `Self { … }` 构造 | 报 `E0050: unresolved name: Self`，`-> Self` 在固有 impl 里已经可用，构造要用具体结构体名 |
