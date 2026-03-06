"use client";

import { useState, useCallback } from "react";
import {
  Loader,
  Wand2,
  Globe,
  Smartphone,
  Search,
  Sparkles,
  ExternalLink,
  Apple,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Doc } from "@/convex/_generated/dataModel";

interface AppStealerTabProps {
  session?: Doc<"sessions">;
  onClose?: () => void;
}

type InputType = "name" | "appstore" | "playstore" | "website";

const inputTypeConfig: Record<
  InputType,
  {
    icon: React.ReactNode;
    label: string;
    placeholder: string;
    description: string;
    color: string;
  }
> = {
  name: {
    icon: <Search className="h-4 w-4" />,
    label: "App Name",
    placeholder: "e.g., Duolingo, Spotify, Instagram",
    description: "Search by app name across stores",
    color: "text-blue-400",
  },
  appstore: {
    icon: <Apple className="h-4 w-4" />,
    label: "App Store",
    placeholder: "https://apps.apple.com/app/...",
    description: "Paste an iOS App Store URL",
    color: "text-gray-400",
  },
  playstore: {
    icon: <Store className="h-4 w-4" />,
    label: "Play Store",
    placeholder: "https://play.google.com/store/apps/...",
    description: "Paste a Google Play Store URL",
    color: "text-green-400",
  },
  website: {
    icon: <Globe className="h-4 w-4" />,
    label: "Website",
    placeholder: "https://example.com",
    description: "Paste any website or landing page",
    color: "text-purple-400",
  },
};

export default function AppStealerTab({
  session,
  onClose,
}: AppStealerTabProps) {
  const [input, setInput] = useState("");
  const [inputType, setInputType] = useState<InputType>("name");
  const [isLoading, setIsLoading] = useState(false);

  // Auto-detect input type from URL patterns
  const handleInputChange = useCallback((value: string) => {
    setInput(value);

    // Auto-detect type based on URL
    if (value.includes("apps.apple.com") || value.includes("itunes.apple.com")) {
      setInputType("appstore");
    } else if (value.includes("play.google.com")) {
      setInputType("playstore");
    } else if (value.startsWith("http://") || value.startsWith("https://")) {
      setInputType("website");
    }
    // Keep current type if it's just text (could be app name)
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) {
      toast.error("Please enter an app name or URL");
      return;
    }

    if (!session?._id) {
      toast.error("No active session");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/steal-app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session._id,
          input: input.trim(),
          inputType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start app research");
      }

      toast.success("App research started! Check the chat for updates.");

      // Close the tab
      setInput("");
      onClose?.();
    } catch (error) {
      console.error("Steal app error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start app research");
    } finally {
      setIsLoading(false);
    }
  };

  const config = inputTypeConfig[inputType];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Wand2 className="h-5 w-5 text-rose-400" />
        <span className="font-medium text-sm">App Stealer</span>
        <span className="ml-auto text-xs text-muted-foreground bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full">
          Beta
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Description */}
        <div className="text-sm text-muted-foreground">
          <p>
            Research any app and recreate it with AI. Enter an app name or paste
            a link to get started.
          </p>
        </div>

        {/* Input Type Selector */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Source Type
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(inputTypeConfig) as InputType[]).map((type) => {
              const typeConfig = inputTypeConfig[type];
              const isActive = inputType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setInputType(type)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all",
                    isActive
                      ? "border-rose-500/50 bg-rose-500/10 text-rose-400"
                      : "border-border/50 hover:border-border hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <span className={cn(isActive ? "text-rose-400" : typeConfig.color)}>
                    {typeConfig.icon}
                  </span>
                  <span>{typeConfig.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="app-input" className="text-xs text-muted-foreground">
              {config.description}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {config.icon}
              </span>
              <Input
                id="app-input"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={config.placeholder}
                className="pl-10 bg-background/50 border-border/50 focus:border-rose-500/50"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={cn(
              "w-full gap-2",
              "bg-gradient-to-r from-rose-500 to-pink-500",
              "hover:from-rose-600 hover:to-pink-600",
              "text-white font-medium"
            )}
          >
            {isLoading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Researching...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Steal App
              </>
            )}
          </Button>
        </form>

        {/* Info Section */}
        <div className="space-y-3 pt-4 border-t border-border/50">
          <h4 className="text-xs text-muted-foreground uppercase tracking-wider">
            What happens next
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-rose-500/20 flex items-center justify-center text-xs text-rose-400 shrink-0">
                1
              </div>
              <p className="text-muted-foreground">
                AI researches the app (description, features, screenshots)
              </p>
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-rose-500/20 flex items-center justify-center text-xs text-rose-400 shrink-0">
                2
              </div>
              <p className="text-muted-foreground">
                Analysis results stream to your chat in real-time
              </p>
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-5 rounded-full bg-rose-500/20 flex items-center justify-center text-xs text-rose-400 shrink-0">
                3
              </div>
              <p className="text-muted-foreground">
                Claude automatically builds a recreation of the app
              </p>
            </div>
          </div>
        </div>

        {/* Examples */}
        <div className="space-y-2">
          <h4 className="text-xs text-muted-foreground uppercase tracking-wider">
            Try these examples
          </h4>
          <div className="flex flex-wrap gap-2">
            {["Duolingo", "Notion", "Calm", "Strava"].map((app) => (
              <button
                key={app}
                type="button"
                onClick={() => {
                  setInput(app);
                  setInputType("name");
                }}
                className="text-xs px-2.5 py-1 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                {app}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
