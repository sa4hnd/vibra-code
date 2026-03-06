"use client";

import { useEffect, useState } from "react";

import MobilePreview from "../mobile-preview";
import { Doc } from "@/convex/_generated/dataModel";

export default function Preview({ session, previewWidth = 50 }: { session?: Doc<"sessions">; previewWidth?: number }) {
  const [isUrlAvailable, setIsUrlAvailable] = useState(false);

  // Determine if we should show controls and QR code based on width
  // Hide when preview width is less than 35% (getting cramped)
  const showControls = previewWidth >= 35;

  // Exponential backoff polling for URL availability
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;
    let currentInterval = 2000; // Start at 2 seconds
    const maxInterval = 30000; // Max 30 seconds

    const checkUrlAvailability = async () => {
      if (session?.tunnelUrl && isMounted) {
        try {
          const response = await fetch("/api/check-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: session.tunnelUrl }),
          });
          const data = await response.json() as { available: boolean };
          if (isMounted) {
            setIsUrlAvailable(data.available);
            // Stop polling once URL is available
            if (data.available) {
              return; // Don't schedule next check
            }
            // Exponential backoff: increase interval up to max
            currentInterval = Math.min(currentInterval * 1.5, maxInterval);
            timeoutId = setTimeout(checkUrlAvailability, currentInterval);
          }
        } catch (error) {
          console.error("Error checking URL availability:", error);
          if (isMounted) {
            setIsUrlAvailable(false);
            // Still schedule next check with backoff
            currentInterval = Math.min(currentInterval * 1.5, maxInterval);
            timeoutId = setTimeout(checkUrlAvailability, currentInterval);
          }
        }
      }
    };

    // Only start polling if URL exists and we haven't confirmed it's available yet
    if (session?.tunnelUrl && !isUrlAvailable) {
      checkUrlAvailability(); // Initial check
    }

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [session?.tunnelUrl, isUrlAvailable]);

  return (
    <div className="w-full h-full bg-background rounded-xl overflow-hidden flex flex-col border border-border/50 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/50 flex-shrink-0">
        <span className="text-sm font-medium">Preview</span>
      </div>

      {/* Preview content */}
      <div className="flex-1 min-h-0">
        <MobilePreview
          url={session?.tunnelUrl || ""}
          isLoading={!session?.tunnelUrl || !isUrlAvailable}
          loadingLabel={
            session?.tunnelUrl && !isUrlAvailable
              ? "GENERATING PREVIEW"
              : (session?.status?.replace(/_/g, " ") ?? "BOOTING MACHINE")
          }
          showControls={showControls}
        />
      </div>
    </div>
  );
}
