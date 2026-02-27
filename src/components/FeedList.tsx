import { Rss, Trash2, Mic, FileText } from "lucide-react";

export interface Feed {
  id: string;
  name: string;
  type: "podcast" | "newsletter";
  url: string;
  active: boolean;
}

interface FeedListProps {
  feeds: Feed[];
  onRemove: (id: string) => void;
}

const FeedList = ({ feeds, onRemove }: FeedListProps) => {
  const podcasts = feeds.filter((f) => f.type === "podcast");
  const newsletters = feeds.filter((f) => f.type === "newsletter");

  const renderGroup = (items: Feed[], label: string, icon: React.ReactNode) => (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
        {icon}
        {label} ({items.length})
      </h3>
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground italic pl-6">No {label.toLowerCase()} added yet.</p>
      )}
      {items.map((feed) => (
        <div
          key={feed.id}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-elevated px-4 py-2.5 group animate-fade-in"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Rss className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{feed.name}</span>
          </div>
          <button
            onClick={() => onRemove(feed.id)}
            className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {renderGroup(podcasts, "Podcasts", <Mic className="h-4 w-4 text-podcast" />)}
      {renderGroup(newsletters, "Newsletters", <FileText className="h-4 w-4 text-newsletter" />)}
    </div>
  );
};

export default FeedList;
