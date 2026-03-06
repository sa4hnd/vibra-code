"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus, Terminal, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

interface LogsTabProps {
  session?: Doc<"sessions">;
  onAddToPrompt?: (tag: string) => void;
}

export default function LogsTab({ session, onAddToPrompt }: LogsTabProps) {
  const [logs, setLogs] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!session?.sessionId) {
      setError("No session available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/filesystem/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          path: "/vibe0/expo_logs.txt",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch logs");
      }

      const data = await response.json();
      setLogs(data.content || "No logs available yet");
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setIsLoading(false);
    }
  }, [session?.sessionId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleAddToPrompt = () => {
    onAddToPrompt?.("@expo_logs.txt ");
  };

  const getTimeSinceUpdate = () => {
    if (!lastUpdated) return "Not loaded";
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (seconds < 5) return "Updated just now";
    if (seconds < 60) return `Updated ${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  };

  const renderLogLine = (line: string, index: number) => {
    const lowerLine = line.toLowerCase();
    let icon = null;
    let colorClass = "text-muted-foreground";

    if (lowerLine.includes("error") || lowerLine.includes("failed") || lowerLine.includes("exception")) {
      icon = <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />;
      colorClass = "text-destructive";
    } else if (lowerLine.includes("warn") || lowerLine.includes("warning")) {
      icon = <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />;
      colorClass = "text-yellow-500";
    } else if (lowerLine.includes("success") || lowerLine.includes("done") || lowerLine.includes("started") || lowerLine.includes("✓")) {
      icon = <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />;
      colorClass = "text-green-500";
    } else if (lowerLine.includes("info") || lowerLine.includes("log")) {
      icon = <Info className="h-3 w-3 text-blue-400 flex-shrink-0" />;
      colorClass = "text-blue-400";
    }

    return (
      <div key={index} className="flex items-start gap-2 py-0.5 font-mono text-xs">
        <span className="text-muted-foreground/50 w-8 text-right flex-shrink-0">
          {String(index + 1).padStart(3, "0")}
        </span>
        {icon && <span className="mt-0.5">{icon}</span>}
        <span className={cn("break-all", colorClass)}>{line}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background/50">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-green-500" />
          <span className="text-xs text-muted-foreground">{getTimeSinceUpdate()}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Logs Content */}
      <div className="flex-1 min-h-0 overflow-auto p-3 bg-black/20">
        {error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : isLoading && !logs ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-0">
            {logs.split("\n").map((line, index) => renderLogLine(line, index))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t">
        <Button
          onClick={handleAddToPrompt}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add to prompt
        </Button>
      </div>
    </div>
  );
}
