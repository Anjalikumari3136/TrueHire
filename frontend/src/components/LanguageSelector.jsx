/**
 * LanguageSelector
 * Dropdown for choosing the coding language. Selecting a language updates the
 * Monaco editor's `language` prop, which drives syntax highlighting.
 */
export default function LanguageSelector({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="oa-language" className="text-xs font-medium text-text-secondary">
        Language
      </label>
      <select
        id="oa-language"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg bg-surface-100 border border-white/[0.08]
                   text-text-primary text-sm cursor-pointer
                   focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30
                   transition-all duration-200"
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
