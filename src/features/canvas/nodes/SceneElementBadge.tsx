export function SceneElementBadge({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="absolute -top-2 -left-2 z-10 max-w-[120px] truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm"
      style={{ background: color }}
      title={name}
    >
      {name}
    </div>
  );
}
