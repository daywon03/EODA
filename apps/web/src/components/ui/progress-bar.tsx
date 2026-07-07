type Props = {
  value: number;
  colorClassName?: string;
  className?: string;
};

export function ProgressBar({ value, colorClassName = "bg-vert-ok", className }: Props) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={`h-2.5 bg-gris-light rounded-full overflow-hidden ${className ?? ""}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${colorClassName}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
