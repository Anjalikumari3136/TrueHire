import Editor from "@monaco-editor/react";

/**
 * CodingEditor
 * Thin wrapper around @monaco-editor/react configured to feel like VS Code.
 * The editor content is fully controlled by the parent via `value` / `onChange`,
 * so the code lives in React state (see OAPage).
 */
export default function CodingEditor({ language, value, onChange, height = 600 }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08]">
      <Editor
        height={height}
        language={language}
        theme="vs-dark"
        value={value}
        onChange={(val) => onChange(val ?? "")}
        options={{
          fontSize: 14,
          lineNumbers: "on",
          minimap: { enabled: false },
          automaticLayout: true,
          autoIndent: "full",
          formatOnType: true,
          tabSize: 4,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          padding: { top: 14, bottom: 14 },
          fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
        }}
        loading={
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Loading editor…
          </div>
        }
      />
    </div>
  );
}
