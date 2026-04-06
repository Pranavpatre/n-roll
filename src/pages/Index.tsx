import { useState, useEffect, useCallback, useRef } from "react";
import { Zap, LogOut, Shield, Settings, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DigestCard from "@/components/DigestCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";

interface DigestItem {
  id: string;
  type: "podcast" | "news" | "article";
  title: string;
  source: string;
  guest?: string;
  guestBio?: string;
  author?: string;
  url: string;
  date: string;
  created_at: string;
  points: { heading: string; detail: string }[];
  quote?: string;
  voteScore: number;
  userVote: 1 | -1 | null;
}

type FilterType = "all" | "news" | "podcast" | "article";

// Sort newest first
function sortDigests(items: DigestItem[]): DigestItem[] {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

const Index = () => {
  const [digests, setDigests] = useState<DigestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  const fetchDigests = useCallback(async () => {
    if (!user) return;
    try {
      const { data: digestData, error } = await supabase
        .from("digests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        console.error("Error fetching digests:", error);
        setDigests([]);
        setLoading(false);
        return;
      }
      if (!digestData || digestData.length === 0) {
        setDigests([]);
        setLoading(false);
        return;
      }

      const digestIds = digestData.map((d: any) => d.id);
      const { data: pointsData } = await supabase
        .from("digest_points").select("*").in("digest_id", digestIds).order("sort_order", { ascending: true });

      // votes table may not exist yet (pre-migration) — query gracefully
      const votesRes = await supabase.from("votes").select("digest_id, vote").eq("user_id", user.id);
      const votesData = votesRes.error ? [] : (votesRes.data || []);

      const pointsByDigest: Record<string, { heading: string; detail: string }[]> = {};
      (pointsData || []).forEach((p: any) => {
        if (!pointsByDigest[p.digest_id]) pointsByDigest[p.digest_id] = [];
        pointsByDigest[p.digest_id].push({ heading: p.heading, detail: p.detail });
      });

      const userVotes = new Map<string, 1 | -1>(
        (votesData || []).map((v: any) => [v.digest_id, v.vote as 1 | -1])
      );

      const mapped = digestData.map((d: any) => ({
        id: d.id,
        type: d.type as DigestItem["type"],
        title: d.title,
        source: d.source,
        guest: d.guest || undefined,
        guestBio: d.guest_bio || undefined,
        author: d.author || undefined,
        url: d.url,
        date: d.date,
        created_at: d.created_at,
        points: pointsByDigest[d.id] || [],
        quote: d.quote || undefined,
        voteScore: d.vote_score ?? 0,
        userVote: userVotes.get(d.id) ?? null,
      }));

      setDigests(sortDigests(mapped));
    } catch (e) {
      console.error("fetchDigests error:", e);
      setDigests([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDigests();
  }, [fetchDigests]);

  // Load email preferences (table may not exist pre-migration)
  useEffect(() => {
    if (!user) return;
    supabase.from("email_preferences").select("weekly_digest").eq("user_id", user.id).single()
      .then(({ data }) => { if (data) setWeeklyDigest(data.weekly_digest); })
      .catch(() => { /* table doesn't exist yet */ });
  }, [user]);

  const handleVote = useCallback(async (digestId: string, vote: 1 | -1) => {
    if (!user) return;
    // Optimistic update
    setDigests((prev) => {
      const updated = prev.map((d) => {
        if (d.id !== digestId) return d;
        const oldVote = d.userVote;
        if (oldVote === vote) return { ...d, userVote: null as 1 | -1 | null, voteScore: d.voteScore - vote };
        if (oldVote) return { ...d, userVote: vote, voteScore: d.voteScore + 2 * vote };
        return { ...d, userVote: vote, voteScore: d.voteScore + vote };
      });
      return sortDigests(updated);
    });
    await supabase.rpc("cast_vote", { p_user_id: user.id, p_digest_id: digestId, p_vote: vote });
  }, [user]);

  const toggleWeeklyDigest = useCallback(async () => {
    if (!user) return;
    const newVal = !weeklyDigest;
    setWeeklyDigest(newVal);
    await supabase.from("email_preferences").upsert({ user_id: user.id, weekly_digest: newVal }, { onConflict: "user_id" });
    toast({ title: newVal ? "Weekly digest enabled" : "Weekly digest disabled" });
  }, [user, weeklyDigest, toast]);

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
    <div className="flex flex-col bg-background overflow-hidden" style={{ height: "100dvh" }}>
      {/* Compact header */}
      <header className="border-b border-border bg-surface-elevated flex-shrink-0 z-10">
        <div className="px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-display text-lg text-foreground">AI Buzz</span>
          </div>
          <div className="flex items-center gap-1">
            {/* Filter pills — always visible */}
            <div className="flex items-center gap-1 mr-1">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-full px-2.5 py-1 text-[11px] sm:text-xs font-medium transition-colors ${
                    filter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {isAdmin && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/admin")} title="Admin">
                <Shield className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSettings(!showSettings)} title="Settings">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b border-border bg-card px-4 py-3 flex-shrink-0 z-10">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">Weekly top stories email</span>
            </div>
            <button
              onClick={toggleWeeklyDigest}
              className={`relative w-10 h-5 rounded-full transition-colors ${weeklyDigest ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${weeklyDigest ? "translate-x-5" : ""}`} />
            </button>
          </div>
        </div>
      )}

      {/* Snap-scroll container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-y-contain"
        style={{ scrollSnapType: "y mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {loading && (
          <div className="snap-start flex items-center justify-center" style={{ height: "calc(100dvh - 90px)" }}>
            <div className="text-center space-y-3">
              <Zap className="h-8 w-8 text-primary mx-auto animate-pulse" />
              <p className="text-muted-foreground text-sm">Loading your digest…</p>
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="snap-start flex items-center justify-center" style={{ height: "calc(100dvh - 90px)" }}>
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
            className="snap-start snap-always"
            style={{ height: "calc(100dvh - 90px)" }}
          >
            <DigestCard {...d} onVote={handleVote} />
          </div>
        ))}

        {filtered.length > 0 && (
          <div className="snap-start flex items-center justify-center" style={{ height: "calc(100dvh - 90px)" }}>
            <div className="text-center space-y-2 px-6">
              <p className="font-display text-2xl text-foreground">You're all caught up!</p>
              <p className="text-sm text-muted-foreground">
                {digests.length} articles summarized
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {filtered.length > 0 && (
        <div className="flex-shrink-0 bg-surface-elevated border-t border-border px-4 py-1.5 flex items-center justify-between safe-area-bottom">
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
