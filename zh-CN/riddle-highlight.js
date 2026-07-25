'use strict';

(function () {
    function rawStringMode(hljs) {
        return hljs.END_SAME_AS_BEGIN({
            className: 'string',
            begin: /r(#+)?"/,
            end: /"(#+)?/,
            relevance: 0,
        });
    }

    function stringMode(hljs) {
        return {
            className: 'string',
            begin: /"/,
            end: /"/,
            illegal: /\n/,
            contains: [hljs.BACKSLASH_ESCAPE],
        };
    }

    function registerRiddleLanguage(hljs) {
        if (!hljs || (typeof hljs.getLanguage === 'function' && hljs.getLanguage('riddle'))) {
            return;
        }

        hljs.registerLanguage('riddle', function (hljs) {
            return {
                name: 'Riddle',
                aliases: ['rid'],
                keywords: {
                    keyword: 'let fun struct if else while break continue return as self mod use mut pub super crate enum trait impl match const type extern unsafe safe for in where',
                    literal: 'true false',
                },
                contains: [
                    hljs.C_LINE_COMMENT_MODE,
                    rawStringMode(hljs),
                    stringMode(hljs),
                    {
                        className: 'string',
                        begin: /'(?:\\[\s\S]|[^'\\])'/,
                        relevance: 0,
                    },
                    {
                        className: 'meta',
                        begin: /#\[/,
                        end: /]/,
                        contains: [rawStringMode(hljs), stringMode(hljs)],
                    },
                    {
                        className: 'function',
                        beginKeywords: 'fun',
                        end: /([(<])/,
                        excludeEnd: true,
                        contains: [hljs.inherit(hljs.UNDERSCORE_TITLE_MODE, { className: 'name' })],
                    },
                    {
                        className: 'symbol',
                        begin: /\b[A-Za-z_][A-Za-z0-9_]*(?=\s*::)/,
                        relevance: 0,
                    },
                    {
                        className: 'number',
                        begin: /\b(?:\d+\.\d+(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+|\d+\.)(?:f32|f64)?(?=\W|$)/,
                        relevance: 0,
                    },
                    {
                        className: 'number',
                        begin: /\b\d+(?:i8|i16|i32|i64|isize|u8|u16|u32|u64|usize)?\b/,
                        relevance: 0,
                    },
                    {
                        className: 'type',
                        begin: /\b(?:i8|i16|i32|i64|isize|u8|u16|u32|u64|usize|f32|f64|bool|str|char)\b/,
                        relevance: 0,
                    },
                    {
                        className: 'type',
                        begin: /\b(?:Self|[A-Z][A-Za-z0-9_]*)\b/,
                        relevance: 0,
                    },
                    {
                        className: 'title',
                        begin: /\b(?!if\b|while\b|for\b|match\b)[a-z_][A-Za-z0-9_]*(?=\s*\()/,
                        relevance: 0,
                    },
                    {
                        className: 'variable',
                        begin: /\b(?!(?:let|fun|struct|if|else|while|break|continue|return|as|self|mod|use|mut|pub|super|crate|enum|trait|impl|match|const|type|extern|unsafe|safe|for|in|where|true|false|_)\b)[a-z_][A-Za-z0-9_]*\b/,
                        relevance: 0,
                    },
                ],
            };
        });
    }

    function registerWhenHighlightJsLoads() {
        if (window.hljs) {
            registerRiddleLanguage(window.hljs);
            return;
        }

        var descriptor = Object.getOwnPropertyDescriptor(window, 'hljs');
        if (descriptor && !descriptor.configurable) {
            return;
        }

        Object.defineProperty(window, 'hljs', {
            configurable: true,
            get: function () {
                return undefined;
            },
            set: function (hljs) {
                registerRiddleLanguage(hljs);
                Object.defineProperty(window, 'hljs', {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: hljs,
                });
            },
        });
    }

    function highlightRiddleBlocks(hljs) {
        document.querySelectorAll('code.language-riddle, code.language-rid').forEach(function (block) {
            if (block.dataset.riddleHighlighted === 'true') {
                return;
            }

            if (block.result && block.result.language === 'riddle') {
                block.dataset.riddleHighlighted = 'true';
                return;
            }

            if (typeof hljs.highlightElement === 'function') {
                hljs.highlightElement(block);
            } else {
                hljs.highlightBlock(block);
            }
            block.dataset.riddleHighlighted = 'true';
        });
    }

    function run() {
        if (!window.hljs) {
            return;
        }

        registerRiddleLanguage(window.hljs);
        highlightRiddleBlocks(window.hljs);
    }

    registerWhenHighlightJsLoads();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }
})();
