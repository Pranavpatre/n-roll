import { useState, useEffect, useCallback } from "react";
import { Zap, Settings, Mic, FileText, Youtube, LogOut } from "lucide-react";
import DigestCard from "@/components/DigestCard";
import FeedList, { Feed } from "@/components/FeedList";
import AddFeedForm from "@/components/AddFeedForm";
import StatsBar from "@/components/StatsBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface DigestItem {
  id?: string;
  type: "podcast" | "newsletter";
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
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [digests, setDigests] = useState<DigestItem[]>([]);
  const [activeTab, setActiveTab] = useState("digest");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncingYouTube, setIsSyncingYouTube] = useState(false);
  const [loadingFeeds, setLoadingFeeds] = useState(true);
  const { toast } = useToast();
  const { user, signOut, session } = useAuth();

  const fetchFeeds = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("feeds")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching feeds:", error);
      return;
    }
    setFeeds(
      (data || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.type === "newsletter" ? "newsletter" : "podcast",
        url: f.url,
        active: f.active,
      }))
    );
    setLoadingFeeds(false);
  }, [user]);

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
      return;
    }

    // Fetch points for all digests
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
        type: d.type as "podcast" | "newsletter",
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
  }, [user]);

  useEffect(() => {
    fetchFeeds();
    fetchDigests();
  }, [fetchFeeds, fetchDigests]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch new RSS items
      const { data: rssData, error: rssError } = await supabase.functions.invoke("fetch-rss");
      if (rssError) throw rssError;

      const items = rssData?.items || [];
      if (items.length === 0) {
        toast({ title: "All caught up!", description: "No new items found in your feeds." });
        setIsRefreshing(false);
        return;
      }

      toast({ title: `Found ${items.length} new items`, description: "Generating AI summaries…" });

      // 2. Summarize each item (sequentially to avoid rate limits)
      let successCount = 0;
      for (const item of items) {
        try {
          const { error } = await supabase.functions.invoke("summarize", {
            body: { item },
          });
          if (error) {
            console.error("Summarize error:", error);
            continue;
          }
          successCount++;
        } catch (e) {
          console.error("Summarize failed:", e);
        }
      }

      toast({ title: "Refresh complete!", description: `Generated ${successCount} new digests.` });

      // 3. Reload digests
      await fetchDigests();
      setActiveTab("digest");
    } catch (e: any) {
      console.error("Refresh error:", e);
      toast({ title: "Refresh failed", description: e.message || "Unknown error", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSyncYouTube = async () => {
    setIsSyncingYouTube(true);
    try {
      const providerToken = session?.provider_token;
      if (!providerToken) {
        toast({
          title: "Google sign-in required",
          description: "Sign out and sign back in with Google to sync YouTube subscriptions.",
          variant: "destructive",
        });
        setIsSyncingYouTube(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("sync-youtube", {
        body: { providerToken },
      });
      if (error) throw error;

      toast({
        title: "YouTube synced!",
        description: `${data.synced} new channels added from ${data.total} subscriptions.`,
      });
      await fetchFeeds();
    } catch (e: any) {
      console.error("YouTube sync error:", e);
      toast({ title: "Sync failed", description: e.message || "Unknown error", variant: "destructive" });
    } finally {
      setIsSyncingYouTube(false);
    }
  };

  const handleAddFeed = async (name: string, type: "podcast" | "newsletter", url: string) => {
    if (!user) return;
    const { error } = await supabase.from("feeds").insert({
      user_id: user.id,
      name,
      type,
      url,
      active: true,
    });
    if (error) {
      toast({ title: "Error adding feed", description: error.message, variant: "destructive" });
      return;
    }
    await fetchFeeds();
  };

  const handleRemoveFeed = async (id: string) => {
    const { error } = await supabase.from("feeds").delete().eq("id", id);
    if (error) {
      toast({ title: "Error removing feed", description: error.message, variant: "destructive" });
      return;
    }
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

      {/* Main */}
      <main className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
        <StatsBar
          podcastCount={podcastCount}
          newsletterCount={newsletterCount}
          digestsToday={digests.length}
          lastRun={digests[0]?.date || "—"}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
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
            <div className="max-w-3xl mx-auto space-y-6">
              {digests.length === 0 && !loadingFeeds && (
                <div className="text-center py-16 space-y-3">
                  <Zap className="h-8 w-8 text-muted-foreground mx-auto" />
                  <h3 className="font-display text-xl text-foreground">No digests yet</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Add some RSS feeds or sync your YouTube subscriptions, then hit Refresh to generate AI-powered summaries.
                  </p>
                </div>
              )}
              {digests.map((d, i) => (
                <DigestCard key={d.id || `${d.source}-${i}`} {...d} />
              ))}
              {digests.length > 0 && (
                <p className="text-center text-sm text-muted-foreground pt-6 pb-8">
                  ✅ That's {digests.filter((d) => d.type === "podcast").length} podcast episodes and{" "}
                  {digests.filter((d) => d.type === "newsletter").length} newsletters summarized.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="feeds" className="mt-6">
            <div className="grid md:grid-cols-[1fr,320px] gap-8">
              <div className="space-y-6">
                <FeedList feeds={feeds} onRemove={handleRemoveFeed} />
              </div>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Sync YouTube
                  </h3>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleSyncYouTube}
                    disabled={isSyncingYouTube}
                  >
                    <Youtube className="h-4 w-4" />
                    {isSyncingYouTube ? "Syncing…" : "Sync YouTube Subscriptions"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Requires Google sign-in with YouTube access.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Add a Feed
                  </h3>
                  <AddFeedForm onAdd={handleAddFeed} />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
