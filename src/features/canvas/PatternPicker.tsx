import { useState } from "react";
import { X } from "lucide-react";
import {
  PATTERNS_BY_CATEGORY,
  PATTERN_CATEGORY_LABELS,
  type PatternCategory,
  type PatternTemplate,
} from "@/lib/patterns-catalog";
import { useDiagramActions } from "@/features/diagram";

const CATEGORIES = Object.keys(PATTERN_CATEGORY_LABELS) as PatternCategory[];

interface PatternPickerProps {
  onClose: () => void;
}

const PatternPicker = ({ onClose }: PatternPickerProps) => {
  const [activeCategory, setActiveCategory] = useState<PatternCategory>(CATEGORIES[0]);
  const { insertPattern } = useDiagramActions();

  const handleInsert = (template: PatternTemplate) => {
    insertPattern(template, { x: 100, y: 200 });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="text-sm font-bold">Architecture Patterns</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Insert a pre-configured set of elements into the canvas
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Category tabs */}
          <nav className="w-40 shrink-0 border-r border-border py-2 overflow-y-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                {PATTERN_CATEGORY_LABELS[cat]}
                <span className="ml-1 text-[10px] font-mono text-muted-foreground">
                  ({PATTERNS_BY_CATEGORY[cat].length})
                </span>
              </button>
            ))}
          </nav>

          {/* Pattern cards */}
          <div className="flex-1 overflow-y-auto p-3 grid gap-2">
            {PATTERNS_BY_CATEGORY[activeCategory].map((pattern) => (
              <button
                key={pattern.id}
                onClick={() => handleInsert(pattern)}
                className="text-left rounded-lg border border-border bg-card hover:bg-surface-hover hover:border-primary/40 transition-all p-3 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {pattern.name}
                  </p>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">
                    {pattern.components.length} elements
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  {pattern.description}
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {pattern.components.map((c, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono bg-secondary text-muted-foreground rounded px-1.5 py-0.5"
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatternPicker;
