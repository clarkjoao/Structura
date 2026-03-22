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

export function CompareSceneBadges({
  a,
  b,
}: {
  a: { name: string; color: string };
  b: { name: string; color: string };
}) {
  return (
    <div className="absolute -top-2 -left-2 z-10 flex max-w-[200px] flex-wrap gap-0.5">
      <span
        className="truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm"
        style={{ background: a.color }}
        title={a.name}
      >
        {a.name}
      </span>
      <span
        className="truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm"
        style={{ background: b.color }}
        title={b.name}
      >
        {b.name}
      </span>
    </div>
  );
}
