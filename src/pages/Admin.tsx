import { useState, useEffect, useCallback } from "react";
import { Shield, Plus, Trash2, RefreshCw, ArrowLeft, Newspaper, Mic, FileText, Youtube, Mail, Check, BookOpen, Search, Sparkles } from "lucide-react";
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

const GOOGLE_CLIENT_ID = "482553307228-13rpfhcgr3fps253nicjoi63nrbhi81q.apps.googleusercontent.com";

function getGmailTokenViaPopup(): Promise<string> {
  return new Promise((resolve, reject) => {
    const redirectUri = window.location.origin + "/oauth-callback.html";
    const scope = "https://www.googleapis.com/auth/gmail.readonly";
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(scope)}` +
      `&prompt=consent`;

    const popup = window.open(url, "gmail-oauth", "width=500,height=600");
    if (!popup) {
      reject(new Error("Popup blocked — please allow popups for this site"));
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "gmail-oauth-token" && event.data.access_token) {
        window.removeEventListener("message", handleMessage);
        resolve(event.data.access_token);
      } else if (event.data?.type === "gmail-oauth-error") {
        window.removeEventListener("message", handleMessage);
        reject(new Error(event.data.error || "OAuth failed"));
      }
    };
    window.addEventListener("message", handleMessage);

    // Timeout after 2 minutes
    setTimeout(() => {
      window.removeEventListener("message", handleMessage);
      reject(new Error("OAuth timed out"));
    }, 120000);
  });
}

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
  { value: "article", label: "Article", icon: FileText, color: "text-purple-400" },
] as const;

const getInputConfig = (type: string) => {
  switch (type) {
    case "news":
      return {
        placeholder: "Google News RSS feed URL",
        hint: "Paste a Google News RSS feed URL",
        icons: [Newspaper],
      };
    case "podcast":
      return {
        placeholder: "YouTube channel URL (e.g. youtube.com/@AllInPodcast)",
        hint: "Paste a YouTube channel link",
        icons: [Youtube],
      };
    case "article":
      return {
        placeholder: "Substack or blog RSS feed URL (e.g. simonwillison.substack.com)",
        hint: "Paste a Substack URL or any blog RSS feed",
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
  const [scanningGmail, setScanningGmail] = useState(false);
  const [gmailResults, setGmailResults] = useState<{ name: string; domain: string; rss: string | null; sampleSubject: string }[]>([]);
  const [addedGmailDomains, setAddedGmailDomains] = useState<Set<string>>(new Set());
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());
  const [discoveringYT, setDiscoveringYT] = useState(false);
  const [ytResults, setYtResults] = useState<{ name: string; channelId: string; description: string; subscriberCount: string; thumbnail: string }[]>([]);
  const [addedYTChannels, setAddedYTChannels] = useState<Set<string>>(new Set());

  // No longer need auth state listener for Gmail — using direct Google OAuth popup

  const runGmailScan = async (providerToken: string) => {
    setScanningGmail(true);
    setGmailResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("scan-gmail", {
        body: { providerToken },
      });
      if (error) throw error;
      const newsletters = data?.newsletters || [];
      if (newsletters.length === 0) {
        toast({ title: "No AI newsletters found", description: "We didn't find any AI-related newsletters in your Gmail." });
      } else {
        toast({ title: `Found ${newsletters.length} AI newsletters`, description: "Review and add them below." });
      }
      setGmailResults(newsletters);
    } catch (e: any) {
      toast({ title: "Gmail scan failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setScanningGmail(false);
    }
  };

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
      .limit(200);
    setDigests(data || []);
    setDigestLoading(false);
  }, [user]);

  useEffect(() => {
    fetchFeeds();
    fetchDigests();
  }, [fetchFeeds, fetchDigests]);


  const isYouTubeUrl = (input: string) => {
    return input.includes("youtube.com") || input.includes("youtu.be");
  };

  const deriveNameFromUrl = (url: string, type: string): string => {
    const trimmed = url.trim();
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

      if (feedType === "article") {
        // Auto-detect Substack URLs and append /feed if needed
        if (finalUrl.includes("substack.com") && !finalUrl.endsWith("/feed")) {
          const url = new URL(finalUrl.startsWith("http") ? finalUrl : `https://${finalUrl}`);
          finalUrl = `${url.origin}/feed`;
        }
        sourceType = "rss";
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

      const duplicate = feeds.find((f) => f.url === finalUrl);
      if (duplicate) {
        toast({ title: "Already added", description: `"${duplicate.name}" is already in your feeds.`, variant: "destructive" });
        setAddingFeed(false);
        return;
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
      // Check if we have Gmail feeds that need a token
      const hasGmailFeeds = feeds.some((f) => f.url.startsWith("gmail:"));
      let providerToken: string | null = gmailToken;

      if (hasGmailFeeds && !providerToken) {
        try {
          toast({ title: "Gmail auth needed", description: "A popup will open to refresh Gmail newsletters too" });
          providerToken = await getGmailTokenViaPopup();
          setGmailToken(providerToken);
        } catch {
          toast({ title: "Skipping Gmail feeds", description: "Refreshing RSS feeds only" });
        }
      }

      const { data: rssData, error: rssError } = await supabase.functions.invoke("fetch-rss", {
        body: { providerToken },
      });
      if (rssError) throw rssError;

      const items = rssData?.items || [];

      if (items.length === 0) {
        toast({ title: "All caught up!", description: "No new items found." });
        setIsRefreshing(false);
        return;
      }

      toast({ title: `Found ${items.length} new items`, description: "Generating AI summaries…" });

      let successCount = 0;
      const BATCH_SIZE = 5;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        toast({ title: `Summarizing...`, description: `${i + 1}–${Math.min(i + BATCH_SIZE, items.length)} of ${items.length}` });
        const results = await Promise.allSettled(
          batch.map((item: any) => supabase.functions.invoke("summarize", { body: { item } }))
        );
        successCount += results.filter((r) => r.status === "fulfilled" && !(r as PromiseFulfilledResult<any>).value.error).length;
      }

      toast({ title: "Refresh complete!", description: `Generated ${successCount} new digests.` });
      fetchDigests();
    } catch (e: any) {
      toast({ title: "Refresh failed", description: e.message, variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getGmailToken = async (): Promise<string> => {
    if (gmailToken) return gmailToken;
    const token = await getGmailTokenViaPopup();
    setGmailToken(token);
    return token;
  };

  const handleScanGmail = async () => {
    try {
      toast({ title: "Connecting to Google…", description: "A popup will open for Gmail access" });
      const token = await getGmailToken();
      toast({ title: "Token received", description: "Scanning your Gmail…" });
      runGmailScan(token);
    } catch (e: any) {
      toast({ title: "Gmail auth failed", description: e.message || String(e), variant: "destructive" });
    }
  };

  const handleAddGmailNewsletter = async (newsletter: { name: string; domain: string; rss: string | null }) => {
    if (!user) return;
    try {
      const feedUrl = newsletter.rss || `gmail:${newsletter.domain}`;
      const { error } = await supabase.from("feeds").insert({
        name: newsletter.name,
        url: feedUrl,
        type: "article",
        user_id: user.id,
      });
      if (error) throw error;
      setAddedGmailDomains((prev) => new Set(prev).add(newsletter.domain));
      const source = newsletter.rss ? "RSS feed" : "Gmail (reads emails directly)";
      toast({ title: "Added", description: `${newsletter.name} added via ${source}.` });
      fetchFeeds();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const suggestedSources = [
    { category: "AI Lab Blogs", type: "article", items: [
      { name: "OpenAI Blog", url: "https://openai.com/news/rss.xml" },
      { name: "Google DeepMind Blog", url: "https://deepmind.google/blog/rss.xml" },
      { name: "Anthropic Blog", url: "https://www.anthropic.com/rss.xml" },
      { name: "Microsoft Research AI", url: "https://www.microsoft.com/en-us/research/blog/feed/" },
      { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/" },
      { name: "Mistral AI", url: "https://mistral.ai/news/rss" },
      { name: "xAI / Grok", url: "https://x.ai/blog/rss" },
      { name: "Cohere Blog", url: "https://cohere.com/blog/rss" },
      { name: "Together AI Blog", url: "https://together.ai/blog/rss" },
      { name: "Hugging Face Blog", url: "https://huggingface.co/blog/feed.xml" },
      { name: "Berkeley BAIR Blog", url: "https://bair.berkeley.edu/blog/feed.xml" },
      { name: "Stanford SAIL", url: "https://ai.stanford.edu/blog/feed.xml" },
      { name: "Allen Institute for AI (AI2)", url: "https://allenai.org/blog/rss.xml" },
    ]},
    { category: "Research & Papers", type: "article", items: [
      { name: "Papers with Code", url: "https://paperswithcode.com/rss.xml" },
      { name: "OpenReview", url: "https://openreview.net/rss" },
    ]},
    { category: "Substack Blogs", type: "article", items: [
      { name: "Simon Willison", url: "https://simonwillison.substack.com/feed" },
      { name: "One Useful Thing (Ethan Mollick)", url: "https://oneusefulthing.substack.com/feed" },
      { name: "Import AI (Jack Clark)", url: "https://importai.substack.com/feed" },
      { name: "Semi Analysis", url: "https://semianalysis.com/feed" },
      { name: "The Batch (Andrew Ng)", url: "https://read.deeplearning.ai/feed" },
      { name: "The Gradient", url: "https://thegradient.pub/rss/" },
      { name: "Ahead of AI (Sebastian Raschka)", url: "https://ahead-of-ai.com/feed/" },
    ]},
    { category: "ArXiv Papers", type: "article", items: [
      { name: "ArXiv cs.AI", url: "http://export.arxiv.org/rss/cs.AI" },
      { name: "ArXiv cs.LG", url: "http://export.arxiv.org/rss/cs.LG" },
      { name: "ArXiv cs.CL", url: "http://export.arxiv.org/rss/cs.CL" },
    ]},
    { category: "Reddit", type: "article", items: [
      { name: "r/MachineLearning", url: "https://www.reddit.com/r/MachineLearning/.rss" },
      { name: "r/artificial", url: "https://www.reddit.com/r/artificial/.rss" },
      { name: "r/LocalLLaMA", url: "https://www.reddit.com/r/LocalLLaMA/.rss" },
    ]},
    { category: "Hacker News", type: "article", items: [
      { name: "HN AI Feed", url: "https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT" },
    ]},
    { category: "YouTube Podcasts", type: "podcast", items: [
      { name: "20VC with Harry Stebbings", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCf0PBRjhf0rF8fWBIxTuoWA" },
      { name: "Varun Mayya", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCsQoiOrh7jzKmE8NBofhTnQ" },
      { name: "Diary of a CEO", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCnjgxChqYYnyoqO4k_Q1d6Q" },
      { name: "All-In Podcast", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCESLZhusAkFfsNsApnjF_Cg" },
      { name: "No Priors", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCSI7h9hydQ40K5MJHnCrQvw" },
      { name: "The AI Daily Brief", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCKelCK4ZaO6HeEI1KQjqzWA" },
      { name: "Lenny's Podcast", url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC6t1O76G0jYXOAoYCm153dA" },
    ]},
    { category: "News RSS", type: "news", items: [
      { name: "Google News AI", url: "https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNRGRqTVhZU0FtVnVLQUFQAQ?hl=en-US&gl=US&ceid=US:en" },
      { name: "TechCrunch AI", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
      { name: "VentureBeat AI", url: "https://venturebeat.com/category/ai/feed/" },
      { name: "MIT Tech Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
      { name: "Ars Technica AI", url: "https://arstechnica.com/ai/feed/" },
      { name: "Reuters Technology", url: "https://www.reutersagency.com/feed/?best-topics=tech&post_type=best" },
    ]},
  ];

  const handleAddSuggestion = async (name: string, url: string, type: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("feeds").insert({
        name, url, type, user_id: user.id,
      });
      if (error) throw error;
      setAddedSuggestions((prev) => new Set(prev).add(url));
      toast({ title: "Added", description: `${name} added.` });
      fetchFeeds();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDiscoverYouTube = async () => {
    setDiscoveringYT(true);
    setYtResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("discover-youtube");
      if (error) throw error;
      const channels = data?.channels || [];
      if (channels.length === 0) {
        toast({ title: "No new channels found", description: "All discovered channels are already in your feeds." });
      } else {
        toast({ title: `Found ${channels.length} AI channels`, description: "Review and add them below." });
      }
      setYtResults(channels);
    } catch (e: any) {
      toast({ title: "Discovery failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setDiscoveringYT(false);
    }
  };

  const handleAddYTChannel = async (channel: { name: string; channelId: string }) => {
    if (!user) return;
    try {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;
      const { error } = await supabase.from("feeds").insert({
        name: channel.name, url: rssUrl, type: "podcast", user_id: user.id,
      });
      if (error) throw error;
      setAddedYTChannels((prev) => new Set(prev).add(channel.channelId));
      toast({ title: "Added", description: `${channel.name} added as podcast feed.` });
      fetchFeeds();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
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

        {/* Suggested Sources */}
        <section className="space-y-4">
          <h2 className="font-display text-lg text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Suggested AI Sources
          </h2>
          <p className="text-xs text-muted-foreground">One-click add curated AI content sources — lab blogs, research papers, Substack, ArXiv, Reddit, Hacker News, and news RSS feeds.</p>
          <div className="space-y-4">
            {suggestedSources.map((group) => (
              <div key={group.category}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{group.category}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const alreadyAdded = addedSuggestions.has(item.url) || feeds.some((f) => f.url === item.url);
                    return (
                      <div key={item.url} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                        <span className="text-sm font-medium">{item.name}</span>
                        {alreadyAdded ? (
                          <span className="text-xs text-green-500 flex items-center gap-1"><Check className="h-3 w-3" /> Added</span>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => handleAddSuggestion(item.name, item.url, group.type)} className="h-7 gap-1">
                            <Plus className="h-3 w-3" /> Add
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Discover AI YouTube Channels */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-foreground">Discover AI YouTube Channels</h2>
            <Button variant="outline" size="sm" onClick={handleDiscoverYouTube} disabled={discoveringYT} className="gap-1.5">
              {discoveringYT ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {discoveringYT ? "Searching…" : "Discover"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Search YouTube for AI channels using the YouTube Data API. Add channels to your podcast feeds with one click.
          </p>
          {ytResults.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead className="hidden sm:table-cell">Subscribers</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ytResults.map((ch) => (
                    <TableRow key={ch.channelId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {ch.thumbnail && <img src={ch.thumbnail} alt="" className="h-8 w-8 rounded-full" />}
                          <div>
                            <span className="font-medium">{ch.name}</span>
                            <span className="block text-xs text-muted-foreground truncate max-w-[250px]">{ch.description}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{ch.subscriberCount}</TableCell>
                      <TableCell>
                        {!addedYTChannels.has(ch.channelId) ? (
                          <Button size="sm" variant="ghost" onClick={() => handleAddYTChannel(ch)} className="h-7 gap-1">
                            <Plus className="h-3 w-3" /> Add
                          </Button>
                        ) : (
                          <span className="text-xs text-green-500 flex items-center gap-1"><Check className="h-3 w-3" /> Added</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
