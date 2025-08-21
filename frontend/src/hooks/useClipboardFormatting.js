import { useCallback } from "react";

export function useClipboardFormatting({
  lang,
  autoFormat,
  setClipboard,
  ensurePrettier,
}) {
  return useCallback(
    async (e) => {
      try {
        const text = (e.clipboardData || window.clipboardData).getData("text");
        if (!text) return;
        if (autoFormat && ["javascript", "typescript", "json"].includes(lang)) {
          e.preventDefault();
          let formatted = text;
          if (lang === "json") {
            try {
              formatted = JSON.stringify(JSON.parse(text), null, 2);
            } catch {
              /* ignore */
            }
          } else {
            try {
              const { prettier, plugins } = await ensurePrettier();
              formatted = await prettier.format(text, {
                parser: lang === "typescript" ? "typescript" : "babel",
                plugins,
                semi: true,
                singleQuote: true,
              });
            } catch {
              /* ignore */
            }
          }
          setClipboard((prev) => (prev ? prev + "\n" + formatted : formatted));
        }
      } catch {
        /* ignore */
      }
    },
    [lang, autoFormat, setClipboard, ensurePrettier]
  );
}
