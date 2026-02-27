import { useState } from "react";
import { Zap, Settings, Mic, FileText } from "lucide-react";
import DigestCard from "@/components/DigestCard";
import FeedList, { Feed } from "@/components/FeedList";
import AddFeedForm from "@/components/AddFeedForm";
import StatsBar from "@/components/StatsBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SAMPLE_FEEDS: Feed[] = [
  { id: "1", name: "The Twenty Minute VC", type: "podcast", url: "https://feeds.megaphone.fm/20vc", active: true },
  { id: "2", name: "Lenny's Podcast", type: "podcast", url: "https://feeds.simplecast.com/lenny", active: true },
  { id: "3", name: "All-In Podcast", type: "podcast", url: "https://feeds.megaphone.fm/allin", active: true },
  { id: "4", name: "Stratechery", type: "newsletter", url: "https://stratechery.com/feed", active: true },
  { id: "5", name: "Not Boring", type: "newsletter", url: "https://notboring.co/feed", active: true },
];

const SAMPLE_DIGESTS = [
  {
    type: "podcast" as const,
    title: "Head of Claude Code: What happens after coding is solved | Boris Cherny",
    source: "Lenny's Podcast",
    guest: "Boris Cherny",
    guestBio: "Creator and head of Claude Code at Anthropic",
    url: "https://open.spotify.com/episode/example",
    date: "Today, 10:00 AM",
    points: [
      { heading: "Claude Code's scale", detail: "~4% of all GitHub commits (higher in private repos); DAUs doubled in the past month." },
      { heading: "100% AI-written code", detail: "Hasn't hand-edited code since Nov 2025; ships 10–20–30 PRs/day." },
      { heading: "Origin story", detail: "Began as 'Claude CLI'; stayed terminal-first due to iteration speed." },
      { heading: "Five-stage evolution", detail: "Autocomplete → chat → agents → coworkers → autonomous." },
    ],
    quote: "By the end of the year, everyone's going to be a product manager and everyone codes.",
  },
  {
    type: "podcast" as const,
    title: "The AI Infrastructure Stack in 2026 | Sarah Chen",
    source: "The Twenty Minute VC",
    guest: "Sarah Chen",
    guestBio: "Partner at Benchmark, former CTO at Scale AI",
    url: "https://open.spotify.com/episode/example2",
    date: "Today, 10:00 AM",
    points: [
      { heading: "Inference costs", detail: "Dropped 90% in 18 months; now $0.02/M tokens for mid-tier models." },
      { heading: "Edge AI", detail: "30% of enterprise workloads now run on-device, up from 5% in 2024." },
      { heading: "Open-source convergence", detail: "Llama 4 and Mistral Large now comparable to GPT-5 on most benchmarks." },
    ],
    quote: "The moat isn't the model anymore — it's the data flywheel.",
  },
  {
    type: "newsletter" as const,
    title: "Why Every Company Is Now an AI Company (Whether They Like It or Not)",
    source: "Not Boring",
    author: "Packy McCormick",
    url: "https://notboring.co/p/example",
    date: "Today, 10:00 AM",
    points: [
      { heading: "AI adoption curve", detail: "Enterprise AI spend hit $340B in 2025, projected $520B by 2027." },
      { heading: "The integration tax", detail: "Companies spend 3x on integration vs. model costs; middleware is the real bottleneck." },
      { heading: "Winner-take-most dynamics", detail: "Top 3 players in each vertical capture 70%+ of AI-driven revenue uplift." },
    ],
  },
];

const Index = () => {
  const [feeds, setFeeds] = useState<Feed[]>(SAMPLE_FEEDS);
  const [activeTab, setActiveTab] = useState("digest");

  const handleAddFeed = (name: string, type: "podcast" | "newsletter", url: string) => {
    setFeeds((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name, type, url, active: true },
    ]);
  };

  const handleRemoveFeed = (id: string) => {
    setFeeds((prev) => prev.filter((f) => f.id !== id));
  };

  const podcastCount = feeds.filter((f) => f.type === "podcast").length;
  const newsletterCount = feeds.filter((f) => f.type === "newsletter").length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface-elevated">
        <div className="container max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl text-foreground leading-none">
                Daily Digest
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Podcasts & newsletters, synthesized
              </p>
            </div>
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
        <StatsBar
          podcastCount={podcastCount}
          newsletterCount={newsletterCount}
          digestsToday={SAMPLE_DIGESTS.length}
          lastRun="Today, 10:00 AM"
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted">
            <TabsTrigger value="digest" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Today's Digest
            </TabsTrigger>
            <TabsTrigger value="feeds" className="gap-1.5">
              <Mic className="h-3.5 w-3.5" />
              Manage Feeds
            </TabsTrigger>
          </TabsList>

          <TabsContent value="digest" className="mt-6">
            <div className="space-y-4">
              {SAMPLE_DIGESTS.map((d, i) => (
                <DigestCard key={i} {...d} />
              ))}
              <p className="text-center text-sm text-muted-foreground pt-4">
                ✅ That's {SAMPLE_DIGESTS.filter(d => d.type === "podcast").length} podcast episodes and{" "}
                {SAMPLE_DIGESTS.filter(d => d.type === "newsletter").length} newsletters for today.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="feeds" className="mt-6">
            <div className="grid md:grid-cols-[1fr,320px] gap-8">
              <FeedList feeds={feeds} onRemove={handleRemoveFeed} />
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Add a Feed
                </h3>
                <AddFeedForm onAdd={handleAddFeed} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
