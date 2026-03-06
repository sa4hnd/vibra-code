"use client";

import { useState, useCallback } from "react";
import { Plus, Play, Vibrate, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HapticType {
  id: string;
  name: string;
  type: "impact" | "notification" | "selection";
  style: string;
}

const HAPTICS: HapticType[] = [
  { id: "error", name: "Error Notification", type: "notification", style: "error" },
  { id: "heavy", name: "Heavy Impact", type: "impact", style: "heavy" },
  { id: "light", name: "Light Impact", type: "impact", style: "light" },
  { id: "medium", name: "Medium Impact", type: "impact", style: "medium" },
  { id: "rigid", name: "Rigid Impact", type: "impact", style: "rigid" },
  { id: "selection", name: "Selection Change", type: "selection", style: "" },
  { id: "soft", name: "Soft Impact", type: "impact", style: "soft" },
  { id: "success", name: "Success Notification", type: "notification", style: "success" },
  { id: "warning", name: "Warning Notification", type: "notification", style: "warning" },
];

interface HapticsTabProps {
  onAddToPrompt?: (tag: string) => void;
}

export default function HapticsTab({ onAddToPrompt }: HapticsTabProps) {
  const [selectedHaptics, setSelectedHaptics] = useState<Set<string>>(new Set());

  const toggleHaptic = (hapticId: string) => {
    setSelectedHaptics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hapticId)) {
        newSet.delete(hapticId);
      } else {
        newSet.add(hapticId);
      }
      return newSet;
    });
  };

  const playHaptic = useCallback((haptic: HapticType) => {
    // Web Vibration API - works on supported devices
    if (typeof window !== "undefined" && "navigator" in window && "vibrate" in navigator) {
      switch (haptic.style) {
        case "light":
          navigator.vibrate(20);
          break;
        case "medium":
          navigator.vibrate(50);
          break;
        case "heavy":
          navigator.vibrate(100);
          break;
        case "soft":
          navigator.vibrate(30);
          break;
        case "rigid":
          navigator.vibrate(80);
          break;
        case "error":
          navigator.vibrate([50, 30, 50, 30, 100]);
          break;
        case "warning":
          navigator.vibrate([50, 30, 50]);
          break;
        case "success":
          navigator.vibrate([30, 20, 80]);
          break;
        default:
          navigator.vibrate(40);
      }
    }
  }, []);

  const handleAddToPrompt = () => {
    if (selectedHaptics.size === 0) return;

    // Build tags string for all selected haptics
    const tags = Array.from(selectedHaptics).map(id => `@${id}`).join(" ");
    onAddToPrompt?.(tags + " ");

    // Clear selection after adding
    setSelectedHaptics(new Set());
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background/50">
        <div className="flex items-center gap-2">
          <Vibrate className="h-4 w-4 text-orange-500" />
          <span className="text-xs text-muted-foreground">
            {selectedHaptics.size > 0 ? `${selectedHaptics.size} selected` : "Select haptics"}
          </span>
        </div>
      </div>

      {/* Haptics List */}
      <div className="flex-1 min-h-0 overflow-auto p-2">
        <div className="space-y-1">
          {HAPTICS.map((haptic) => {
            const isSelected = selectedHaptics.has(haptic.id);
            return (
              <div
                key={haptic.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl transition-all duration-200",
                  isSelected
                    ? "bg-orange-500/20 border border-orange-500/40"
                    : "hover:bg-muted/50"
                )}
              >
                <button
                  onClick={() => toggleHaptic(haptic.id)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                    isSelected
                      ? "bg-orange-500 border-orange-500"
                      : "border-muted-foreground/30"
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-sm font-semibold",
                      isSelected ? "text-orange-400" : "text-foreground"
                    )}>
                      {haptic.name}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {haptic.type}
                    </span>
                  </div>
                </button>

                {/* Play button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    playHaptic(haptic);
                  }}
                  className="p-2.5 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Play className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t">
        <Button
          onClick={handleAddToPrompt}
          disabled={selectedHaptics.size === 0}
          className={cn(
            "w-full text-white transition-all",
            selectedHaptics.size > 0
              ? "bg-orange-600 hover:bg-orange-700"
              : "bg-muted text-muted-foreground"
          )}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add to prompt
        </Button>
      </div>
    </div>
  );
}
