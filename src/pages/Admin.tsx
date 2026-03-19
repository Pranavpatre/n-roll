import { useState, useEffect, useCallback } from "react";
import { Shield, Plus, Trash2, RefreshCw, ArrowLeft, Newspaper, Mic, FileText, Youtube, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Feed {
  id: string;
  name: string;
  type: string;
  url: string;
  active: boolean;
}

interface Digest {
  id: string;
  title: string;
  source: string;
  type: string;
  date: string;
  url: string;
}

const typeOptions = [
  { value: "news", label: "News", icon: Newspaper, color: "text-news" },
  { value: "podcast", label: "Podcast", icon: Mic, color: "text-podcast" },
  { value: "newsletter", label: "Newsletter", icon: FileText, color: "text-newsletter" },
] as const;

const getInputConfig = (type: string) => {
  switch (type) {
    case "news":
      return {
        placeholder: "YouTube channel URL or X/Twitter handle (e.g. @elikisd)",
        hint: "Paste a YouTube channel link or an X/Twitter handle",
        icons: [Youtube, Twitter],
      };
    case "podcast":
      return {
        placeholder: "YouTube channel URL (e.g. youtube.com/@AllInPodcast)",
        hint: "Paste a YouTube channel link",
        icons: [Youtube],
      };
    case "newsletter":
      return {
        placeholder: "Newsletter RSS feed URL",
        hint: "Paste the RSS feed URL directly",
        icons: [FileText],
      };
    default:
      return { placeholder: "URL", hint: "", icons: [] };
  }
};

const Admin = () => {
  const { user } = useAdmin();
  const { toast } = useToast();

  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [feedUrl, setFeedUrl] = useState("");
  const [feedType, setFeedType] = useState<string>("news");
  const [feedLoading, setFeedLoading] = useState(true);
  const [digests, setDigests] = useState<Digest[]>([]);
  const [digestLoading, setDigestLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [addingFeed, setAddingFeed] = useState(false);

  const fetchFeeds = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("feeds")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setFeeds(data || []);
    setFeedLoading(false);
  }, [user]);

  const fetchDigests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("digests")
      .select("id, title, source, type, date, url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setDigests(data || []);
    setDigestLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFeeds();
    fetchDigests();
  }, [fetchFeeds, fetchDigests]);

  const isXHandle = (input: string) => {
    const trimmed = input.trim();
    return trimmed.startsWith("@") || trimmed.includes("twitter.com/") || trimmed.includes("x.com/");
  };

  const isYouTubeUrl = (input: string) => {
    return input.includes("youtube.com") || input.includes("youtu.be");
  };

  const deriveNameFromUrl = (url: string, type: string): string => {
    const trimmed = url.trim();
    if (isXHandle(trimmed)) {
      let handle = trimmed;
      if (handle.includes("twitter.com/") || handle.includes("x.com/")) {
        handle = handle.split("/").pop()?.replace("@", "") || handle;
      }
      handle = handle.replace("@", "");
      return `@${handle}`;
    }
    if (isYouTubeUrl(trimmed)) {
      try {
        const urlObj = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
        const path = urlObj.pathname;
        if (path.startsWith("/@")) return path.slice(1);
        if (path.includes("/channel/")) return path.split("/channel/")[1]?.split("/")[0] || "YouTube Channel";
        if (path.includes("/c/")) return path.split("/c/")[1]?.split("/")[0] || "YouTube Channel";
        return path.split("/").filter(Boolean).pop() || "YouTube Channel";
      } catch {
        return "YouTube Channel";
      }
    }
    // RSS — extract domain
    try {
      const urlObj = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return trimmed.slice(0, 40);
    }
  };

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedUrl.trim() || !user) return;
    setAddingFeed(true);

    try {
      let finalUrl = feedUrl.trim();
      let sourceType = "rss";
      const feedName = deriveNameFromUrl(feedUrl, feedType);

      if (feedType === "newsletter") {
        sourceType = "rss";
      } else if (isXHandle(finalUrl)) {
        let handle = finalUrl;
        if (handle.includes("twitter.com/") || handle.includes("x.com/")) {
          handle = "@" + handle.split("/").pop()?.replace("@", "");
        }
        if (!handle.startsWith("@")) handle = "@" + handle;
        finalUrl = `x:${handle}`;
        sourceType = "x";
      } else if (isYouTubeUrl(finalUrl)) {
        const { data: rssData, error: rssError } = await supabase.functions.invoke("youtube-to-rss", {
          body: { youtubeUrl: finalUrl },
        });
        if (rssError || rssData?.error) {
          toast({ title: "Error", description: rssData?.error || rssError?.message || "Failed to convert YouTube URL", variant: "destructive" });
          setAddingFeed(false);
          return;
        }
        finalUrl = rssData.rssUrl;
        sourceType = "youtube";
      }

      const { error } = await supabase.from("feeds").insert({
        name: feedName,
        url: finalUrl,
        type: feedType,
        user_id: user.id,
      });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setAddingFeed(false);
        return;
      }

      toast({ title: "Feed added", description: `${feedName} added as ${feedType}.` });
      setFeedUrl("");
      fetchFeeds();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingFeed(false);
    }
  };

  const handleDeleteFeed = async (id: string) => {
    await supabase.from("feeds").delete().eq("id", id);
    fetchFeeds();
  };

  const handleDeleteDigest = async (id: string) => {
    await supabase.from("digest_points").delete().eq("digest_id", id);
    await supabase.from("digests").delete().eq("id", id);
    fetchDigests();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const { data: rssData, error: rssError } = await supabase.functions.invoke("fetch-rss");
      if (rssError) throw rssError;

      const items = rssData?.items || [];
      if (items.length === 0) {
        toast({ title: "All caught up!", description: "No new items found." });
        setIsRefreshing(false);
        return;
      }

      toast({ title: `Found ${items.length} new items`, description: "Generating AI summaries…" });

      let successCount = 0;
      for (const item of items) {
        try {
          const { error } = await supabase.functions.invoke("summarize", { body: { item } });
          if (error) continue;
          successCount++;
        } catch {}
      }

      toast({ title: "Refresh complete!", description: `Generated ${successCount} new digests.` });
      fetchDigests();
    } catch (e: any) {
      toast({ title: "Refresh failed", description: e.message, variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const TypeIcon = ({ type }: { type: string }) => {
    const opt = typeOptions.find((t) => t.value === type) || typeOptions[0];
    const Icon = opt.icon;
    return <Icon className={`h-4 w-4 ${opt.color}`} />;
  };

  const inputConfig = getInputConfig(feedType);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface-elevated">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-display text-xl text-foreground">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Refreshing…" : "Refresh Feeds"}
            </Button>
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* Add Feed */}
        <section className="space-y-4">
          <h2 className="font-display text-lg text-foreground">Add Feed</h2>
          <form onSubmit={handleAddFeed} className="space-y-3">
            <div className="flex gap-1.5">
              {typeOptions.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFeedType(t.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    feedType === t.value
                      ? `bg-${t.value}/15 ${t.color}`
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px] space-y-1">
                <Input
                  placeholder={inputConfig.placeholder}
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {inputConfig.icons.map((Ic, i) => (
                    <Ic key={i} className="h-3 w-3" />
                  ))}
                  {inputConfig.hint}
                </p>
              </div>
              <Button type="submit" size="sm" className="gap-1.5" disabled={addingFeed}>
                {addingFeed ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {addingFeed ? "Adding…" : "Add"}
              </Button>
            </div>
          </form>
        </section>

        {/* Feeds Table */}
        <section className="space-y-4">
          <h2 className="font-display text-lg text-foreground">Feeds ({feeds.length})</h2>
          {feedLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : feeds.length === 0 ? (
            <p className="text-muted-foreground text-sm">No feeds yet. Add one above.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">URL</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeds.map((feed) => (
                    <TableRow key={feed.id}>
                      <TableCell><TypeIcon type={feed.type} /></TableCell>
                      <TableCell className="font-medium">{feed.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs truncate max-w-[300px]">
                        {feed.url}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleDeleteFeed(feed.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Digests Table */}
        <section className="space-y-4">
          <h2 className="font-display text-lg text-foreground">Recent Digests ({digests.length})</h2>
          {digestLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : digests.length === 0 ? (
            <p className="text-muted-foreground text-sm">No digests yet.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden sm:table-cell">Source</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {digests.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell><TypeIcon type={d.type} /></TableCell>
                      <TableCell className="font-medium max-w-[300px] truncate">
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                          {d.title}
                        </a>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{d.source}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{d.date}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleDeleteDigest(d.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Admin;
