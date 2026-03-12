interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
}

const Field = ({ label, value, onChange, multiline, placeholder, hint }: FieldProps) => {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
        />
      )}
      {hint && (
        <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
};

export default Field;
