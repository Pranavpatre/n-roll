import { Activity, Mic, FileText, Newspaper, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StatsBarProps {
  totalDigests: number;
  newsCount: number;
  podcastCount: number;
  newsletterCount: number;
  lastRun?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const StatsBar = ({ totalDigests, newsCount, podcastCount, newsletterCount, lastRun, onRefresh, isRefreshing }: StatsBarProps) => {
  const stats = [
    { label: "Total Digests", value: totalDigests, icon: <Activity className="h-4 w-4 text-success" /> },
    { label: "News", value: newsCount, icon: <Newspaper className="h-4 w-4 text-news" /> },
    { label: "Podcasts", value: podcastCount, icon: <Mic className="h-4 w-4 text-podcast" /> },
    { label: "Newsletters", value: newsletterCount, icon: <FileText className="h-4 w-4 text-newsletter" /> },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overview</h2>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing…" : "Refresh Feeds"}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface-elevated p-4 shadow-card">
            <div className="flex items-center gap-2 mb-1">
              {s.icon}
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-2xl font-display text-foreground">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsBar;
