import { read } from "fs";
import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
// We'll dynamically import monaco-editor to keep initial bundle lean.
let monacoPromise;
async function getMonaco() {
  if (!monacoPromise) {
    monacoPromise = import(/* @vite-ignore */ "monaco-editor");
  }
  return monacoPromise;
}

// Map our internal language names to Monaco identifiers
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
  rust: "rust", // may need community extension; fallback plaintext
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
    focus: () => {
      editorRef.current?.focus();
    },
    getEditor: () => editorRef.current,
  }));

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;
    (async () => {
      const monaco = await getMonaco();
      if (!mounted || !containerRef.current) return;
      const { editor } = monaco;
      const modelLang = LANG_MAP[lang] || "plaintext";
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

      editorRef.current = editor.create(containerRef.current, {
        value: value,
        language: modelLang,
        theme: "github-dark",
        automaticLayout: true,
        wordWrap: "on",
        minimap: { enabled: false },
        fontSize: 14,
        lineHeight: 22,
        fontFamily:
          "JetBrains Mono, Fira Code, Cascadia Code, Consolas, monospace",
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        padding: { top: 8, bottom: 16 },
        renderWhitespace: "selection",
        tabSize: 2,
        lineNumbersMinChars: 2,
        lineDecorationsWidth: 6,
        glyphMargin: false,
        folding: false,
        contextmenu: false,
        readOnly: false,
        options={{formatOnPaste: true,formatOnType: true, autoIndent: "full",}}
      });

      // Collect real disposable objects only (addCommand returns an ID number, not disposable)
      const disposables = [];
      const commandIds = [];

      // Raw paste capture (before Monaco processes) to allow custom formatting logic
      function handleNativePaste(e) {
        if (onPaste) {
          const res = onPaste(e);
          // If handler prevented default & updated value, Monaco will receive new prop via effect.
          return res;
        }
      }
      containerRef.current.addEventListener("paste", handleNativePaste, true);

      // Change listener
      disposables.push(
        editorRef.current.onDidChangeModelContent(() => {
          const v = editorRef.current.getValue();
          lastValueRef.current = v;
          onChange(v);
        })
      );

      // Keybindings for save/cancel while editing a version
      const { KeyMod, KeyCode } = monaco;
      commandIds.push(
        editorRef.current.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => {
          if (editingVersion != null) onSaveEdit?.();
        })
      );
      commandIds.push(
        editorRef.current.addCommand(KeyCode.Escape, () => {
          if (editingVersion != null) onCancelEdit?.();
        })
      );

      // Cleanup
      return () => {
        containerRef.current?.removeEventListener(
          "paste",
          handleNativePaste,
          true
        );
        disposables.forEach(
          (d) => d && typeof d.dispose === "function" && d.dispose()
        );
        editorRef.current?.dispose();
      };
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update language when changed
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
      editorRef.current.updateOptions({
        lineNumbers: lang === "plain" ? "off" : "on",
      });
    })();
  }, [lang]);

  // External value updates (e.g., restore version). Avoid loops.
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
