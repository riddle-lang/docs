'use strict';

(function () {
    function registerRiddleLanguage(hljs) {
        if (!hljs || (typeof hljs.getLanguage === 'function' && hljs.getLanguage('riddle'))) {
            return;
        }

        hljs.registerLanguage('riddle', function (hljs) {
            return {
                name: 'Riddle',
                aliases: ['rid'],
                keywords: {
                    keyword: 'let mut fun fn struct trait impl for if else while return break continue Self',
                    literal: 'true false nil',
                    built_in: 'print clone',
                },
                contains: [
                    hljs.C_LINE_COMMENT_MODE,
                    hljs.C_BLOCK_COMMENT_MODE,
                    {
                        className: 'string',
                        contains: [hljs.BACKSLASH_ESCAPE],
                        variants: [{ begin: /"/, end: /"/ }],
                    },
                    {
                        className: 'number',
                        variants: [{ begin: /\b\d+\b/ }],
                        relevance: 0,
                    },
                    {
                        className: 'type',
                        begin: /\b(?:i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|str|char)\b/,
                        relevance: 0,
                    },
                    {
                        className: 'title',
                        begin: /\b[A-Z][A-Za-z0-9_]*\b/,
                        relevance: 0,
                    },
                ],
            };
        });
    }

    function highlightRiddleBlocks(hljs) {
        document.querySelectorAll('code.language-riddle, code.language-rid').forEach(function (block) {
            hljs.highlightBlock(block);
        });
    }

    function run() {
        if (!window.hljs) {
            return;
        }

        registerRiddleLanguage(window.hljs);
        highlightRiddleBlocks(window.hljs);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }
})();
