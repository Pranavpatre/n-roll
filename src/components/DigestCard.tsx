import { Mic, FileText, Newspaper, Clock, ExternalLink } from "lucide-react";

interface DigestCardProps {
  type: "podcast" | "newsletter" | "news";
  title: string;
  source: string;
  guest?: string;
  guestBio?: string;
  author?: string;
  url: string;
  date: string;
  points: { heading: string; detail: string }[];
  quote?: string;
}

const typeMeta = {
  podcast: { icon: Mic, className: "bg-podcast/10 text-podcast" },
  newsletter: { icon: FileText, className: "bg-newsletter/10 text-newsletter" },
  news: { icon: Newspaper, className: "bg-news/10 text-news" },
};

const DigestCard = ({
  type,
  title,
  source,
  guest,
  guestBio,
  author,
  url,
  date,
  points,
  quote,
}: DigestCardProps) => {
  const meta = typeMeta[type];
  const Icon = meta.icon;

  return (
    <article
      className="group rounded-lg border border-border bg-surface-elevated p-6 md:p-8 shadow-card transition-shadow hover:shadow-elevated animate-fade-in"
      style={{ animationDelay: "0.05s" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
            <Icon className="h-3 w-3" />
            {source}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {date}
          </span>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {/* Title */}
      <h3 className="font-display text-xl mb-1 text-foreground leading-snug">"{title}"</h3>

      {/* Guest / Author */}
      {guest && (
        <p className="text-sm text-muted-foreground mb-3">
          <span className="font-medium text-foreground">Guest:</span> {guest}
          {guestBio && <span> — {guestBio}</span>}
        </p>
      )}
      {author && !guest && (
        <p className="text-sm text-muted-foreground mb-3">
          <span className="font-medium text-foreground">By</span> {author}
        </p>
      )}

      {/* Key Points */}
      <div className="space-y-2 mb-3">
        {points.map((point, i) => (
          <div key={i} className="text-sm leading-relaxed">
            <span className="font-semibold text-foreground">{point.heading}</span>
            <span className="text-muted-foreground"> — {point.detail}</span>
          </div>
        ))}
      </div>

      {/* Quote */}
      {quote && (
        <blockquote className="border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
          "{quote}"
        </blockquote>
      )}
    </article>
  );
};

export default DigestCard;
