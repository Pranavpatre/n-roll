import { useState, useEffect, useCallback, useRef } from "react";
import { Zap, LogOut, Shield, Filter, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DigestCard from "@/components/DigestCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";

interface DigestItem {
  id?: string;
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

type FilterType = "all" | "news" | "podcast" | "article";

const REFRESH_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

const Index = () => {
  const [digests, setDigests] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  // Gmail OAuth now uses popup — no redirect needed

  const fetchDigests = useCallback(async () => {
    if (!user) return;
    const { data: digestData, error } = await supabase
      .from("digests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
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

  // Auto-sync: fetch new feed items + summarize on page load (with cooldown)
  const autoSync = useCallback(async () => {
    if (!user) return;
    const cacheKey = `digest_last_sync_${user.id}`;
    const lastSync = localStorage.getItem(cacheKey);
    if (lastSync && Date.now() - Number(lastSync) < REFRESH_COOLDOWN_MS) return;

    setSyncing(true);
    try {
      const { data: rssData, error: rssError } = await supabase.functions.invoke("fetch-rss");
      if (rssError) throw rssError;

      const items = rssData?.items || [];
      if (items.length > 0) {
        let successCount = 0;
        const BATCH_SIZE = 5;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map((item: any) => supabase.functions.invoke("summarize", { body: { item } }))
          );
          successCount += results.filter((r) => r.status === "fulfilled" && !(r as PromiseFulfilledResult<any>).value.error).length;
        }
        if (successCount > 0) {
          toast({ title: "New digests!", description: `${successCount} new summaries added.` });
          await fetchDigests();
        }
      }
      localStorage.setItem(cacheKey, String(Date.now()));
    } catch (e) {
      console.error("Auto-sync failed:", e);
    } finally {
      setSyncing(false);
    }
  }, [user, fetchDigests, toast]);

  useEffect(() => {
    fetchDigests().then(() => autoSync());
  }, [fetchDigests, autoSync]);

  const filtered = filter === "all" ? digests : digests.filter((d) => d.type === filter);

  // Handle scroll snap index tracking
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const index = Math.round(el.scrollTop / el.clientHeight);
      setCurrentIndex(index);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [filtered]);

  // Reset scroll position on filter change
  useEffect(() => {
    setCurrentIndex(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [filter]);

  const filters: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "news", label: "News" },
    { value: "podcast", label: "Podcasts" },
    { value: "article", label: "Articles" },
  ];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Compact header */}
      <header className="border-b border-border bg-surface-elevated flex-shrink-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-display text-lg text-foreground">AI Buzz</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Filter pills */}
            <div className="hidden sm:flex items-center gap-1 mr-2">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Mobile filter */}
            <div className="sm:hidden relative">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="appearance-none bg-muted text-foreground text-xs rounded-full px-3 py-1.5 pr-6 border-0 focus:ring-1 focus:ring-primary"
              >
                {filters.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <Filter className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            </div>

            {syncing && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">Syncing…</span>
              </div>
            )}
            {isAdmin && (
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} title="Admin">
                <Shield className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Snap-scroll container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto snap-y snap-mandatory"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {loading && (
          <div className="h-full snap-start flex items-center justify-center">
            <div className="text-center space-y-3">
              <Zap className="h-8 w-8 text-primary mx-auto animate-pulse" />
              <p className="text-muted-foreground text-sm">Loading your digest…</p>
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="h-full snap-start flex items-center justify-center">
            <div className="text-center space-y-3 px-6">
              <Zap className="h-8 w-8 text-muted-foreground mx-auto" />
              <h3 className="font-display text-xl text-foreground">No digests yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Fresh AI-powered summaries will appear here once new content is available.
              </p>
            </div>
          </div>
        )}

        {filtered.map((d, i) => (
          <div
            key={d.id || `${d.source}-${i}`}
            className="h-full snap-start snap-always"
            style={{ minHeight: "calc(100vh - 52px)" }}
          >
            <DigestCard {...d} />
          </div>
        ))}

        {filtered.length > 0 && (
          <div className="h-full snap-start flex items-center justify-center">
            <div className="text-center space-y-2 px-6">
              <p className="font-display text-2xl text-foreground">You're all caught up! ✅</p>
              <p className="text-sm text-muted-foreground">
                {digests.length} articles summarized
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {filtered.length > 0 && (
        <div className="flex-shrink-0 bg-surface-elevated border-t border-border px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {Math.min(currentIndex + 1, filtered.length)} / {filtered.length}
          </span>
          <div className="flex gap-0.5">
            {filtered.slice(0, 20).map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === currentIndex ? "w-4 bg-primary" : "w-1 bg-muted-foreground/30"
                }`}
              />
            ))}
            {filtered.length > 20 && (
              <span className="text-xs text-muted-foreground ml-1">+{filtered.length - 20}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
