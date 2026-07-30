# 形式化语法

以下是 Riddle 语言的完整形式化文法定义，使用扩展 BNF 记法。

```
program = statement*;

attribute = "#" "[" attribute_body "]";
attribute_body = balanced tokens until matching "]";

statement =
    attribute* (
    use_decl
  | mod_decl
  | extern_block
  | extern_fn_decl
  | enum_decl
  | trait_decl
  | impl_decl
  | const_decl
  | type_alias_decl
  | var_decl
  | func_decl
  | struct_decl
  | return_stmt
  | expr_stmt
  );

// == FFI ==

extern_block = "unsafe" "extern" string_lit "{" (extern_func_sig ";")* "}";

extern_func_sig = ("safe" | "unsafe")? "fun" ident "(" (param ("," param)*)? ")" ("->" ty)? ";";

extern_fn_decl = "pub"? "unsafe"? "extern" string_lit func_def;

// == module / use ==

mod_decl = "mod" ident (";" | "{" statement* "}");

use_decl = "use" use_tree ";";

use_tree =
    path (("as" ident) | ("::" "*") | ("::" "{" use_tree ("," use_tree)* ","? "}"))?
  | "{" use_tree ("," use_tree)* ","? "}";

// == items ==

enum_decl = "enum" ident item_generic_params? where_clause? "{" (enum_variant ("," enum_variant)* ","?)? "}";
enum_variant = attribute* ident ("(" type_list? ")")? ("{" struct_field_list? "}")?;

trait_decl = "trait" ident (":" generic_bound ("+" generic_bound)*)? "{" trait_item* "}";
trait_item = attribute* (func_decl | assoc_type_decl);

impl_decl = "impl" generic_params? ty ("for" ty)? where_clause? "{" impl_item* "}";
impl_item = attribute* (func_decl | type_alias_decl | const_decl);

func_sig = "unsafe"? "fun" ident generic_params? "(" (param ("," param)*)? ")" ("->" ty)? where_clause?;
type_alias_decl = "type" ident "=" ty ";";
assoc_type_decl = "type" ident ("=" ty)? ";";
const_decl = "const" ident ":" ty "=" expression ";";

item_generic_params = "<" item_generic_param ("," item_generic_param)* ">";
item_generic_param = ident | "const" ident ":" ty;

generic_params = "<" generic_param ("," generic_param)* ">";
generic_param = ident (":" generic_bound ("+" generic_bound)*)? | "const" ident ":" ty;
generic_bound = callable_bound | path ("<" generic_bound_arg ("," generic_bound_arg)* ","? ">")?;
generic_bound_arg = ident "=" ty | ty;
callable_bound = ("Fn" | "FnMut" | "FnOnce") "(" type_list? ")" "->" ty;
where_clause = "where" where_predicate ("," where_predicate)* ","?;
where_predicate = ty ":" generic_bound ("+" generic_bound)*;

type_args = "<" type_list? ">";
type_list = ty ("," ty)* ","?;

// == normal statements ==

var_decl = "let" pattern (":" ty)? ("=" expression)? ";";

param = attribute* ((("&" "mut"?)? "self") | ("mut"? ident ":" ty));

func_def = "fun" ident generic_params? "(" (param ("," param)*)? ")" ("->" ty)? where_clause? block;
func_decl = "pub"? "unsafe"? "fun" ident generic_params? "(" (param ("," param)*)? ")" ("->" ty)? where_clause? (block | ";");

block = "{" statement* expression? "}";

struct_param = attribute* "pub"? ident ":" ty;

struct_decl = "struct" ident item_generic_params? where_clause? "{" (struct_param ("," struct_param)* ","?)? "}";

return_stmt = "return" expression? ";";

expr_stmt = expr_without_block ";" | expr_with_block ";"?;

// == expression ==

expression = expr_with_block | expr_without_block;

expr_with_block = block | if_expr | while_expr | for_expr | match_expr | unsafe_expr;

if_expr = "if" expression block ("else" (if_expr | block))?;

while_expr = "while" expression block;

for_expr = "for" pattern "in" expression block;

match_expr = "match" expression "{" match_arm ("," match_arm)* ","? "}";
match_arm = attribute* pattern ("if" expression)? "=>" expression;

unsafe_expr = "unsafe" block;

expr_without_block = unary (("as" ty) | (binop unary))*;

lambda_expr = "move"? "fun" "(" (lambda_param ("," lambda_param)*)? ")" ("->" ty)? block;
lambda_param = "mut"? ident (":" ty)?;

unary = prefix_op unary | postfix;

postfix = primary ( "::" "<" type_arg_list ">" "(" arg_list ")" | "(" arg_list ")" | "." ident | "[" expression "]" | struct_expr_fields | "::" "<" type_arg_list ">" struct_expr_fields | "." ident "(" arg_list ")" )*;

arg_list = (expression ("," expression)*)?;

type_arg_list = ty ("," ty)*;

primary = literal | path | array_expr | tuple_expr | lambda_expr | "(" expression? ")";

tuple_expr = "(" expression "," ")"
           | "(" expression ("," expression)+ ","? ")";

array_expr = "[" "]"
           | "[" expression ("," expression)* ","? "]"
           | "[" expression ";" expression "]";

struct_expr = path struct_expr_fields;
struct_expr_fields = "{" (struct_expr_field ("," struct_expr_field)* ","?)? "}";

struct_expr_field = ident (":" expression)?;

pattern = attribute* ("_" | "mut"? ident | literal | path | reference_pattern | tuple_pattern | struct_pattern | enum_pattern);

reference_pattern = "&" "mut"? pattern;
tuple_pattern = "(" (pattern ("," pattern)* ","?)? ")";
struct_pattern = path "{" (field_pattern ("," field_pattern)* ","?)? "}";
field_pattern = attribute* ident (":" pattern)?;
enum_pattern = path | path "(" (pattern ("," pattern)* ","?)? ")" | path "{" (field_pattern ("," field_pattern)* ","?)? "}";

// Precedence & Associativity (Pratt binding powers)
//
// Assignment:
//   = += -= *= /= %= &= |= ^= <<= >>=   right-assoc       (lbp=1,  rbp=1)
//
// Prefix (right):  + - & && * !       rbp = 14
//
// Postfix:
//   () . []        left-assoc        (lbp = 15)
//
// Infix:
//   as                            (lbp=13, rbp=13)
//   *  /  %        left-assoc        (lbp=12, rbp=13)
//   +  -           left-assoc        (lbp=10, rbp=11)
//   & | ^ << >>    left-assoc        (lbp=9,  rbp=10)
//   <  >  <=  >=   left-assoc        (lbp=8,  rbp=9)
//   ==  !=         left-assoc        (lbp=5,  rbp=6)
//   &&             left-assoc        (lbp=4,  rbp=5)
//   ||             left-assoc        (lbp=2,  rbp=3)
//
// In `if`, `while`, `for`, and `match` heads, struct expressions are disabled so
// `if Foo { ... }` keeps parsing `{ ... }` as the control-flow block.

// == path / type ==

path_segment = (ident | "self" | "super" | "crate") ("::" type_args)?;
path = ("::")? path_segment ("::" path_segment)*;

ty = attribute* (
     "!"
   | path type_args?
   | "&" "mut"? ty
   | "&&" ty
   | "*" ("const" | "mut") ty
   | "[" ty (";" expression)? "]"
   | int_lit
   | impl_callable_type
   | "(" (ty ("," ty)* ","?)? ")"
   );

impl_callable_type = "impl" callable_bound;

// == operators ==

prefix_op = "+" | "-" | "&" | "&&" | "*" | "!";

binop = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "&=" | "|=" | "^=" | "<<=" | ">>="
      | "||" | "&&" | "==" | "!=" | "<" | ">" | "<=" | ">="
      | "|" | "^" | "&" | "<<" | ">>"
      | "+" | "-" | "*" | "/" | "%";

// == literals ==

literal = int_lit | float_lit | string_lit | char_lit | bool_lit;

int_lit = [0-9]+ ("i8" | "i16" | "i32" | "i64" | "isize"
                | "u8" | "u16" | "u32" | "u64" | "usize")?;
float_lit = [0-9]+ ("." [0-9]+)? ([eE] [+-]? [0-9]+)? ("f32" | "f64")?;
string_lit = "\"" ... "\"" | "r" "#"* "\"" ... "\"" "#"*;
char_lit = "'" ... "'";
bool_lit = "true" | "false";

ident = [a-zA-Z_][a-zA-Z0-9_]*;
```

`&pattern` 和 `&mut pattern` 分别解构一层同可变性的共享引用和可变引用；它们可以嵌套，例如 `&&mut value`。Riddle 不提供 `ref name` 或 `ref mut name` 绑定语法。结构化模式匹配引用时会自动解引用并让内部绑定继承引用模式；默认绑定模式变为引用后，内部不能再写 `mut binding` 或显式 `&pattern` / `&mut pattern`。需要显式引用模式时，应让它出现在默认 `move` 模式的位置。详见[控制流](./control-flow.md#引用模式与匹配人体工学)。

`let` 可以在声明处初始化，也可以省略初始化式并稍后赋值：`let pattern = expression;`、`let pattern: Type;` 和可由首次赋值推断类型的 `let pattern;` 都是合法语法。延迟初始化的绑定必须在每条到达使用点的路径上先完成赋值；否则会报告 `E0059`。引用解构依赖初始化式的值类别，因此不能用于延迟初始化声明。`type Name;` 只用于 trait 中声明关联类型；模块和 `impl` 中的类型别名需要写出 `= Type`。
