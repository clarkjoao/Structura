interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}

const Field = ({ label, value, onChange, multiline }: FieldProps) => (
  <div>
    <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
      {label}
    </label>
    {multiline ? (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
    ) : (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    )}
  </div>
);

export default Field;
