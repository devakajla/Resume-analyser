export function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const styles: Record<string, string> = {
    draft: "bg-secondary text-muted-foreground",
    live: "bg-primary/15 text-primary",
    closed: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
        styles[s] || "bg-secondary text-muted-foreground"
      }`}
    >
      {status}
    </span>
  );
}

export function ScoreBadge({ score, suffix = "" }: { score: number; suffix?: string }) {
  let color = "bg-danger/15 text-danger";
  if (score >= 80) color = "bg-success/15 text-success";
  else if (score >= 60) color = "bg-warning/15 text-warning";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${color}`}>
      {Math.round(score)}{suffix}
    </span>
  );
}

export function MatchBadge({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/15 text-primary">
      {Math.round(value * 100)}%
    </span>
  );
}