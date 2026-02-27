import { Activity, Mic, FileText, Calendar } from "lucide-react";

interface StatsBarProps {
  podcastCount: number;
  newsletterCount: number;
  digestsToday: number;
  lastRun?: string;
}

const StatsBar = ({ podcastCount, newsletterCount, digestsToday, lastRun }: StatsBarProps) => {
  const stats = [
    { label: "Podcast Feeds", value: podcastCount, icon: <Mic className="h-4 w-4 text-podcast" /> },
    { label: "Newsletter Feeds", value: newsletterCount, icon: <FileText className="h-4 w-4 text-newsletter" /> },
    { label: "Digests Today", value: digestsToday, icon: <Activity className="h-4 w-4 text-success" /> },
    { label: "Last Run", value: lastRun || "—", icon: <Calendar className="h-4 w-4 text-muted-foreground" /> },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-border bg-surface-elevated p-4 shadow-card"
        >
          <div className="flex items-center gap-2 mb-1">
            {s.icon}
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
          <p className="text-2xl font-display text-foreground">{s.value}</p>
        </div>
      ))}
    </div>
  );
};

export default StatsBar;
