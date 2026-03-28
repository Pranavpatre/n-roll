import { Mic, FileText, Newspaper, BookOpen, ExternalLink, ChevronDown } from "lucide-react";

interface DigestCardProps {
  type: "podcast" | "news" | "article";
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
  podcast: { icon: Mic, label: "Podcast", className: "bg-podcast/15 text-podcast border-podcast/20" },
  news: { icon: Newspaper, label: "News", className: "bg-news/15 text-news border-news/20" },
  article: { icon: BookOpen, label: "Article", className: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
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
    <div className="h-full w-full flex flex-col p-4 sm:p-8 md:p-10">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col justify-center max-w-2xl mx-auto w-full">
        {/* Badge + Date */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold border ${meta.className}`}>
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
          <span className="text-[11px] sm:text-xs text-muted-foreground">{date}</span>
        </div>

        {/* Source */}
        <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
          {source}
        </p>

        {/* Title */}
        <h2 className="font-display text-xl sm:text-3xl md:text-4xl text-foreground leading-tight mb-3">
          {title}
        </h2>

        {/* Guest / Author */}
        {guest && (
          <p className="text-xs sm:text-sm text-muted-foreground mb-3">
            <span className="font-medium text-foreground">Guest:</span> {guest}
            {guestBio && <span> — {guestBio}</span>}
          </p>
        )}
        {author && !guest && (
          <p className="text-xs sm:text-sm text-muted-foreground mb-3">
            <span className="font-medium text-foreground">By</span> {author}
          </p>
        )}

        {/* Key Points */}
        <div className="space-y-2.5 mb-3">
          {points.slice(0, 3).map((point, i) => (
            <div key={i} className="flex gap-2.5 items-start">
              <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="text-xs sm:text-sm leading-relaxed">
                <span className="font-semibold text-foreground">{point.heading}</span>
                <span className="text-muted-foreground"> — {point.detail}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Quote */}
        {quote && (
          <blockquote className="border-l-2 border-primary/40 pl-3 text-xs sm:text-sm italic text-muted-foreground">
            "{quote}"
          </blockquote>
        )}
      </div>

      {/* Bottom section — always pinned */}
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full pt-3 flex items-center justify-between">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {type === "podcast" ? "Listen" : "Read"}{" "}<ExternalLink className="h-3.5 w-3.5" />
        </a>
        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground animate-bounce">
          <ChevronDown className="h-3.5 w-3.5" />
          Scroll
        </div>
      </div>
    </div>
  );
};

export default DigestCard;
