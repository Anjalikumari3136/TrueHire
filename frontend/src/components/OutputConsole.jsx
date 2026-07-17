/**
 * OutputConsole
 * Placeholder output panel shown below the Run/Submit buttons.
 * For now it just renders static text; Judge0 execution results will be wired
 * in here later.
 */
export default function OutputConsole({ output }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-surface-50 overflow-hidden">
      {/* Console header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-surface-100">
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-error/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-unverified/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-verified/70" />
        </span>
        <span className="text-xs font-medium text-text-muted ml-1">Output</span>
      </div>

      {/* Console body */}
      <pre className="px-4 py-4 text-sm font-mono text-text-secondary whitespace-pre-wrap min-h-[96px]">
        {output}
      </pre>
    </div>
  );
}
