import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddFeedFormProps {
  onAdd: (name: string, type: "podcast" | "newsletter", url: string) => void;
}

const AddFeedForm = ({ onAdd }: AddFeedFormProps) => {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"podcast" | "newsletter">("podcast");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    onAdd(name.trim(), type, url.trim());
    setName("");
    setUrl("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("podcast")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            type === "podcast"
              ? "bg-podcast/15 text-podcast"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          🎙️ Podcast
        </button>
        <button
          type="button"
          onClick={() => setType("newsletter")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            type === "newsletter"
              ? "bg-newsletter/15 text-newsletter"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          📝 Newsletter
        </button>
      </div>
      <Input
        placeholder="Feed name (e.g. Lenny's Podcast)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        placeholder="RSS feed URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <Button type="submit" size="sm" className="w-full gap-1.5">
        <Plus className="h-4 w-4" />
        Add Feed
      </Button>
    </form>
  );
};

export default AddFeedForm;
