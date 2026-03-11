import { useState, useEffect, useCallback } from "react";
import { Zap, LogOut } from "lucide-react";
import DigestCard from "@/components/DigestCard";
import StatsBar from "@/components/StatsBar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface DigestItem {
  id?: string;
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

const Index = () => {
  const [digests, setDigests] = useState<DigestItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user, signOut } = useAuth();

  const fetchDigests = useCallback(async () => {
    if (!user) return;
    const { data: digestData, error } = await supabase
      .from("digests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.error("Error fetching digests:", error);
      return;
    }
    if (!digestData || digestData.length === 0) {
      setDigests([]);
      setLoading(false);
      return;
    }

    const digestIds = digestData.map((d: any) => d.id);
    const { data: pointsData } = await supabase
      .from("digest_points")
      .select("*")
      .in("digest_id", digestIds)
      .order("sort_order", { ascending: true });

    const pointsByDigest: Record<string, { heading: string; detail: string }[]> = {};
    (pointsData || []).forEach((p: any) => {
      if (!pointsByDigest[p.digest_id]) pointsByDigest[p.digest_id] = [];
      pointsByDigest[p.digest_id].push({ heading: p.heading, detail: p.detail });
    });

    setDigests(
      digestData.map((d: any) => ({
        id: d.id,
        type: d.type as DigestItem["type"],
        title: d.title,
        source: d.source,
        guest: d.guest || undefined,
        guestBio: d.guest_bio || undefined,
        author: d.author || undefined,
        url: d.url,
        date: d.date,
        points: pointsByDigest[d.id] || [],
        quote: d.quote || undefined,
      }))
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDigests();
  }, [fetchDigests]);

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
          if (error) { console.error("Summarize error:", error); continue; }
          successCount++;
        } catch (e) { console.error("Summarize failed:", e); }
      }

      toast({ title: "Refresh complete!", description: `Generated ${successCount} new digests.` });
      await fetchDigests();
    } catch (e: any) {
      console.error("Refresh error:", e);
      toast({ title: "Refresh failed", description: e.message || "Unknown error", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const newsCount = digests.filter((d) => d.type === "news").length;
  const podcastCount = digests.filter((d) => d.type === "podcast").length;
  const newsletterCount = digests.filter((d) => d.type === "newsletter").length;

  return (
    <div className="min-h-screen bg-background">
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
                AI News, Tools, Podcasts & Newsletters
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
        <StatsBar
          totalDigests={digests.length}
          newsCount={newsCount}
          podcastCount={podcastCount}
          newsletterCount={newsletterCount}
          lastRun={digests[0]?.date || "—"}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <div className="max-w-3xl mx-auto space-y-6">
          {digests.length === 0 && !loading && (
            <div className="text-center py-16 space-y-3">
              <Zap className="h-8 w-8 text-muted-foreground mx-auto" />
              <h3 className="font-display text-xl text-foreground">No digests yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Fresh AI-powered summaries will appear here once new content is available.
              </p>
            </div>
          )}
          {digests.map((d, i) => (
            <DigestCard key={d.id || `${d.source}-${i}`} {...d} />
          ))}
          {digests.length > 0 && (
            <p className="text-center text-sm text-muted-foreground pt-6 pb-8">
              ✅ {newsCount} news, {podcastCount} podcasts, {newsletterCount} newsletters summarized.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
