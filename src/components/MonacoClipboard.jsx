import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
// Ensure Monaco editor base styles are loaded (needed when using ESM editor.api)
let monacoPromise;
async function getMonaco() {
  if (!monacoPromise) {
    // Import lean ESM editor API instead of full package
    monacoPromise = import(
      /* @vite-ignore */ "monaco-editor/esm/vs/editor/editor.api"
    );
    // Setup workers once (Vite-friendly URLs)
    if (!window.__monacoWorkersSetup) {
      window.MonacoEnvironment = {
        getWorker: function (_moduleId, label) {
          if (label === "json") {
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/json/json.worker.js",
                import.meta.url
              ),
              { type: "module" }
            );
          }
          if (label === "css" || label === "scss" || label === "less") {
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/css/css.worker.js",
                import.meta.url
              ),
              { type: "module" }
            );
          }
          if (label === "html" || label === "handlebars" || label === "razor") {
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/html/html.worker.js",
                import.meta.url
              ),
              { type: "module" }
            );
          }
          if (label === "typescript" || label === "javascript") {
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/typescript/ts.worker.js",
                import.meta.url
              ),
              { type: "module" }
            );
          }
          return new Worker(
            new URL(
              "monaco-editor/esm/vs/editor/editor.worker.js",
              import.meta.url
            ),
            { type: "module" }
          );
        },
      };
      window.__monacoWorkersSetup = true;
    }
  }
  return monacoPromise;
}
const LANG_MAP = {
  plain: "plaintext",
  javascript: "javascript",
  typescript: "typescript",
  json: "json",
  python: "python",
  java: "java",
  csharp: "csharp",
  cpp: "cpp",
  go: "go",
  rust: "rust",
  sql: "sql",
};
export const MonacoClipboard = forwardRef(function MonacoClipboard(
  { value, onChange, lang, editingVersion, onSaveEdit, onCancelEdit, onPaste },
  ref
) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const lastValueRef = useRef(value);
  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    getEditor: () => editorRef.current,
  }));
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      const monaco = await getMonaco();
      if (cancelled || !containerRef.current) return;
      const { editor } = monaco;
      editor.defineTheme("github-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#0d1117",
          "editor.foreground": "#c9d1d9",
          "editor.lineHighlightBackground": "#161b22",
          "editorCursor.foreground": "#58a6ff",
          "editor.selectionBackground": "#264f78",
          "editor.inactiveSelectionBackground": "#22272e",
          "editorLineNumber.foreground": "#8b949e",
          "editorLineNumber.activeForeground": "#c9d1d9",
          "editorIndentGuide.background": "#21262d",
          "editorIndentGuide.activeBackground": "#484f58",
        },
      });
      const isPlainInit = lang === "plain";
      const instance = editor.create(containerRef.current, {
        value,
        language: LANG_MAP[lang] || "plaintext",
        theme: "github-dark",
        automaticLayout: true,
        wordWrap: "on",
        minimap: { enabled: false },
        readOnly: false,
        fontSize: 14,
        lineHeight: 22,
        fontFamily:
          "JetBrains Mono, Fira Code, Cascadia Code, Consolas, monospace",
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        padding: { top: 12, bottom: 16 },
        renderWhitespace: "selection",
        tabSize: 2,
        lineNumbers: isPlainInit ? "off" : "on",
        lineNumbersMinChars: 2,
        lineDecorationsWidth: 10,
        glyphMargin: false,
        folding: false,
        contextmenu: false,
      });
      editorRef.current = instance;

      const disposables = [];
      function handleNativePaste(e) {
        if (onPaste) onPaste(e);
      }
      containerRef.current.addEventListener("paste", handleNativePaste, true);
      disposables.push(
        instance.onDidChangeModelContent(() => {
          const v = instance.getValue();
          lastValueRef.current = v;
          onChange(v);
        })
      );
      const { KeyMod, KeyCode } = monaco;
      disposables.push(
        instance.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => {
          if (editingVersion != null) onSaveEdit?.();
        })
      );
      disposables.push(
        instance.addCommand(KeyCode.Escape, () => {
          if (editingVersion != null) onCancelEdit?.();
        })
      );

      cleanup = () => {
        try {
          containerRef.current?.removeEventListener(
            "paste",
            handleNativePaste,
            true
          );
        } catch {}
        disposables.forEach(
          (d) => d && typeof d.dispose === "function" && d.dispose()
        );
        try {
          instance.dispose();
        } catch {}
        if (editorRef.current === instance) editorRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);
  useEffect(() => {
    if (!editorRef.current) return;
    (async () => {
      const monaco = await getMonaco();
      const model = editorRef.current.getModel();
      const monacoLang = LANG_MAP[lang] || "plaintext";
      if (monacoLang !== "plaintext") {
        import(
          /* @vite-ignore */ `monaco-editor/esm/vs/basic-languages/${monacoLang}/${monacoLang}.js`
        ).catch(() => {});
      }
      monaco.editor.setModelLanguage(model, monacoLang);
      const isPlain = lang === "plain";
      editorRef.current.updateOptions({
        lineNumbers: isPlain ? "off" : "on",
        lineNumbersMinChars: 2,
        lineDecorationsWidth: 10,
        glyphMargin: false,
        folding: false,
        padding: { top: 12, bottom: 16 },
      });
    })();
  }, [lang]);
  useEffect(() => {
    if (!editorRef.current) return;
    if (value !== lastValueRef.current) {
      const sel = editorRef.current.getSelection();
      editorRef.current.setValue(value);
      if (sel) editorRef.current.setSelection(sel);
      lastValueRef.current = value;
    }
  }, [value]);
  return <div className="monaco-clipboard" ref={containerRef} />;
});
