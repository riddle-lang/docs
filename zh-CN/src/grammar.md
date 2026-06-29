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

extern_block = "extern" string_lit "{" (func_sig ";")* "}";

extern_fn_decl = "extern" string_lit func_decl;

// == module / use ==

mod_decl = "mod" ident (";" | "{" statement* "}");

use_decl = "use" use_tree ";";

use_tree =
    path (("as" ident) | ("::" "*") | ("::" "{" use_tree ("," use_tree)* ","? "}"))?
  | "{" use_tree ("," use_tree)* ","? "}";

// == items ==

enum_decl = "enum" ident generic_params? "{" (enum_variant ("," enum_variant)* ","?)? "}";
enum_variant = attribute* ident ("(" type_list? ")")? ("{" struct_field_list? "}")?;

trait_decl = "trait" ident "{" trait_item* "}";
trait_item = attribute* (func_sig | type_alias_decl);

impl_decl = "impl" generic_params? path ("for" ty)? "{" impl_item* "}";
impl_item = attribute* (func_decl | type_alias_decl | const_decl);

func_sig = "fun" ident "(" (param ("," param)*)? ")" ("->" ty)?;
type_alias_decl = "type" ident ("=" ty)? ";";
const_decl = "const" ident ":" ty ("=" expression)? ";";

generic_params = "<" ident ("," ident)* ">";
type_args = "<" type_list? ">";
type_list = ty ("," ty)* ","?;

// == normal statements ==

var_decl = "let" "mut"? ident (":" ty)? ("=" expression)? ";";

param = attribute* ((("&" "mut"?)? "self") | (ident ":" ty));

func_decl = "fun" ident "(" (param ("," param)*)? ")" ("->" ty)? (block | ";");

block = "{" statement* expression? "}";

struct_param = attribute* ident ":" ty;

struct_decl = "struct" ident generic_params? "{" (struct_param ("," struct_param)* ","?)? "}";

return_stmt = "return" expression? ";";

expr_stmt = expr_without_block ";" | expr_with_block ";"?;

// == expression ==

expression = expr_with_block | expr_without_block;

expr_with_block = block | if_expr | while_expr | match_expr | unsafe_expr;

if_expr = "if" expression block ("else" (if_expr | block))?;

while_expr = "while" expression block;

match_expr = "match" expression "{" match_arm ("," match_arm)* ","? "}";
match_arm = attribute* pattern ("if" expression)? "=>" expression;

unsafe_expr = "unsafe" block;

expr_without_block = unary (("as" ty) | (binop unary))*;

unary = prefix_op unary | postfix;

postfix = primary ( "(" arg_list ")" | "." ident | "[" expression "]" | struct_expr_fields | "." ident "(" arg_list ")" )*;

arg_list = (expression ("," expression)*)?;

primary = literal | path | array_expr | "(" expression? ")";

array_expr = "[" (expression ("," expression)* ","?)? "]";

struct_expr = path struct_expr_fields;
struct_expr_fields = "{" (struct_expr_field ("," struct_expr_field)* ","?)? "}";

struct_expr_field = ident (":" expression)?;

pattern = attribute* ("_" | ident | literal | path | tuple_pattern | struct_pattern | enum_pattern);

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
// In `if`, `while`, and `match` heads, struct expressions are disabled so
// `if Foo { ... }` keeps parsing `{ ... }` as the control-flow block.

// == path / type ==

path = ("::")? (ident | "self" | "super" | "crate")
       ("::" (ident | "self" | "super" | "crate"))*;

ty = attribute* (
     path type_args?
   | "&" "mut"? ty
   | "*" ("const" | "mut") ty
   | "[" ty ";" expression? "]"
   | "(" (ty ("," ty)* ","?)? ")"
   );

// == operators ==

prefix_op = "+" | "-" | "&" | "&&" | "*" | "!";

binop = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "&=" | "|=" | "^=" | "<<=" | ">>="
      | "||" | "&&" | "==" | "!=" | "<" | ">" | "<=" | ">="
      | "|" | "^" | "&" | "<<" | ">>"
      | "+" | "-" | "*" | "/" | "%";

// == literals ==

literal = int_lit | float_lit | string_lit | char_lit | bool_lit;

int_lit = [0-9]+ ("i8" | "i16" | "i32" | "i64" | "i128" | "isize"
                | "u8" | "u16" | "u32" | "u64" | "u128" | "usize")?;
float_lit = [0-9]+ ("." [0-9]+)? ([eE] [+-]? [0-9]+)? ("f16" | "f32" | "f64" | "f128")?;
string_lit = "\"" ... "\"";
char_lit = "'" ... "'";
bool_lit = "true" | "false";

ident = [a-zA-Z_][a-zA-Z0-9_]*;
```
