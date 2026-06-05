// Three chisels: petit, moyen, gros. Visual preview = real disc size.

export default function ToolPalette({ tools, currentId, onSelect, disabled }) {
  return (
    <div className="flex gap-3 items-end">
      {tools.map((t) => {
        const selected = t.id === currentId;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            disabled={disabled}
            className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition shadow-sm font-zen text-sm ${
              selected
                ? 'bg-bark-600 dark:bg-sage-600 text-beige-50 border-bark-600 dark:border-sage-600'
                : 'bg-beige-100 dark:bg-bark-700 text-bark-700 dark:text-beige-100 border-bark-500/30 dark:border-beige-200/20 hover:bg-beige-200 dark:hover:bg-bark-600'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <div className="h-14 w-14 flex items-center justify-center">
              <div
                className={`rounded-full ${
                  selected ? 'bg-beige-50' : 'bg-bark-600 dark:bg-beige-100'
                }`}
                style={{ width: t.radius * 2, height: t.radius * 2 }}
              />
            </div>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
