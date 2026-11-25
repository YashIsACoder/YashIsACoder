// CodeMirror for /write/, bundled into one file. Rebuild with:
//   npx esbuild entry.js --bundle --format=esm --minify --outfile=codemirror.js
export { EditorState, EditorSelection, Compartment, StateEffect } from '@codemirror/state';
export { EditorView, keymap, drawSelection, highlightActiveLine, placeholder, ViewPlugin, Decoration, MatchDecorator, dropCursor } from '@codemirror/view';
export { history, historyKeymap, defaultKeymap, undo, redo, undoDepth, redoDepth, indentWithTab } from '@codemirror/commands';
export { markdown, markdownLanguage, markdownKeymap } from '@codemirror/lang-markdown';
export { syntaxHighlighting, HighlightStyle, syntaxTree, LanguageDescription, indentUnit } from '@codemirror/language';
export { tags } from '@lezer/highlight';
export { cpp } from '@codemirror/lang-cpp';
export { python } from '@codemirror/lang-python';
export { javascript } from '@codemirror/lang-javascript';
export { search, searchKeymap, openSearchPanel, closeSearchPanel, highlightSelectionMatches } from '@codemirror/search';
export { autocompletion, completionKeymap, startCompletion, closeCompletion } from '@codemirror/autocomplete';
