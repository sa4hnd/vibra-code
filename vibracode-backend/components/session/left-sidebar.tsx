"use client";

import { useState, useEffect } from "react";
import { Code, Database, Settings, X, DollarSign, Terminal, Trash2, RotateCcw, Vibrate, MoreHorizontal, Server, Sparkles, Copy, ExternalLink, Check, Image, Music, Video, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CodeTab from "@/components/code-tab";
import DatabaseTab from "@/components/database-tab";
import EnvsTab from "@/components/envs-tab";
import { PaymentsTab } from "@/components/payments-tab";
import LogsTab from "@/components/logs-tab";
import HapticsTab from "@/components/haptics-tab";
import APITab from "@/components/api-tab";
import ImageStudioTab from "@/components/image-studio-tab";
import AudioStudioTab from "@/components/audio-studio-tab";
import VideoStudioTab from "@/components/video-studio-tab";
import AppStealerTab from "@/components/app-stealer-tab";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

type TabType = "code" | "database" | "envs" | "payments" | "logs" | "haptics" | "api" | "images" | "audio" | "video" | "stealer" | null;

interface LeftSidebarProps {
  session?: Doc<"sessions">;
  onExpandedChange?: (expanded: boolean) => void;
  onAddToPrompt?: (tag: string) => void;
  onSendMessage?: (message: string) => void;
  onAddImageToChat?: (file: File) => void;
}

interface SidebarButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  colorClass?: string;
  showLabel?: boolean;
  hideTooltip?: boolean;
}

function SidebarButton({ icon, label, isActive, onClick, colorClass, showLabel, hideTooltip }: SidebarButtonProps) {
  const button = (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center p-2.5 rounded-lg transition-all duration-200",
        showLabel ? "justify-start gap-2.5" : "justify-center",
        "hover:bg-muted/50",
        isActive && "bg-primary/10 text-primary border border-primary/20",
        !isActive && colorClass,
        !isActive && !colorClass && "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      {showLabel && (
        <span className="text-xs font-medium truncate whitespace-nowrap">{label}</span>
      )}
    </button>
  );

  // Don't show tooltip when labels are visible or when hideTooltip is true
  if (showLabel || hideTooltip) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {button}
      </TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function LeftSidebar({ session, onExpandedChange, onAddToPrompt, onSendMessage, onAddImageToChat }: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>(null);
  const [refreshKey] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [showAppStoreDialog, setShowAppStoreDialog] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const clearMessages = useMutation(api.messages.clearBySession);

  // Check if GitHub is connected
  const hasGitHubConnected = !!session?.githubRepository;

  const isExpanded = activeTab !== null;

  // Notify parent when expansion state changes
  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

  const handleTabClick = (tab: TabType) => {
    if (activeTab === tab) {
      setIsAnimating(true);
      setTimeout(() => {
        setActiveTab(null);
        setIsAnimating(false);
      }, 150);
    } else {
      setActiveTab(tab);
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setActiveTab(null);
      setIsAnimating(false);
    }, 150);
  };

  // Wrapper for Add to prompt that closes sidebar after adding
  const handleAddToPromptAndClose = (text: string) => {
    onAddToPrompt?.(text);
    // Close the sidebar so chat becomes visible
    handleClose();
  };

  const handleClearHistory = async () => {
    if (!session?._id || isClearing) return;

    const confirmed = window.confirm(
      "Are you sure you want to clear all chat history? This will start a fresh AI session."
    );

    if (!confirmed) return;

    setIsClearing(true);
    try {
      await clearMessages({ sessionId: session._id as Id<"sessions"> });
      toast.success("Chat history cleared");
    } catch (error) {
      console.error("Failed to clear history:", error);
      toast.error("Failed to clear history");
    } finally {
      setIsClearing(false);
    }
  };

  const handleRestartDevServer = async () => {
    if (!session?.sessionId || isRestarting) return;

    const confirmed = window.confirm(
      "If your app is stuck, frozen, or showing errors, restarting the development server might help.\n\nThis may take up to a minute. Continue?"
    );

    if (!confirmed) return;

    setIsRestarting(true);
    try {
      const response = await fetch("/api/session/restart-dev-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });

      if (!response.ok) {
        throw new Error("Failed to restart server");
      }

      toast.success("Dev server restarted. Your app should reload automatically.");
    } catch (error) {
      console.error("Failed to restart server:", error);
      toast.error("Failed to restart dev server");
    } finally {
      setIsRestarting(false);
    }
  };

  const handleCopyRepoUrl = async () => {
    if (session?.githubRepositoryUrl) {
      await navigator.clipboard.writeText(session.githubRepositoryUrl);
      setIsCopied(true);
      toast.success("Repository URL copied!");
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleOpenExpoLaunch = () => {
    window.open("https://launch.expo.dev", "_blank");
  };

  // Render sidebar buttons with optional labels
  const renderSidebarButtons = (showLabel: boolean, hideTooltip: boolean = false) => (
    <div className="flex-1 flex flex-col gap-1 p-2">
      <SidebarButton
        icon={<Code className="h-5 w-5" />}
        label="Code"
        isActive={activeTab === "code"}
        onClick={() => handleTabClick("code")}
        colorClass="text-blue-400 hover:text-blue-300"
        showLabel={showLabel}
        hideTooltip={hideTooltip}
      />
      <SidebarButton
        icon={<Database className="h-5 w-5" />}
        label="Database"
        isActive={activeTab === "database"}
        onClick={() => handleTabClick("database")}
        colorClass="text-purple-400 hover:text-purple-300"
        showLabel={showLabel}
        hideTooltip={hideTooltip}
      />
      <SidebarButton
        icon={<Settings className="h-5 w-5" />}
        label="Environment"
        isActive={activeTab === "envs"}
        onClick={() => handleTabClick("envs")}
        colorClass="text-gray-400 hover:text-gray-300"
        showLabel={showLabel}
        hideTooltip={hideTooltip}
      />
      <SidebarButton
        icon={<Terminal className="h-5 w-5" />}
        label="Expo Logs"
        isActive={activeTab === "logs"}
        onClick={() => handleTabClick("logs")}
        colorClass="text-green-400 hover:text-green-300"
        showLabel={showLabel}
        hideTooltip={hideTooltip}
      />
      <SidebarButton
        icon={<Vibrate className="h-5 w-5" />}
        label="Haptics"
        isActive={activeTab === "haptics"}
        onClick={() => handleTabClick("haptics")}
        colorClass="text-orange-400 hover:text-orange-300"
        showLabel={showLabel}
        hideTooltip={hideTooltip}
      />
      <SidebarButton
        icon={<Sparkles className="h-5 w-5" />}
        label="API Models"
        isActive={activeTab === "api"}
        onClick={() => handleTabClick("api")}
        colorClass="text-pink-400 hover:text-pink-300"
        showLabel={showLabel}
        hideTooltip={hideTooltip}
      />
      <SidebarButton
        icon={<Image className="h-5 w-5" />}
        label="Images"
        isActive={activeTab === "images"}
        onClick={() => handleTabClick("images")}
        colorClass="text-fuchsia-400 hover:text-fuchsia-300"
        showLabel={showLabel}
        hideTooltip={hideTooltip}
      />
      <SidebarButton
        icon={<Music className="h-5 w-5" />}
        label="Audio"
        isActive={activeTab === "audio"}
        onClick={() => handleTabClick("audio")}
        colorClass="text-purple-400 hover:text-purple-300"
        showLabel={showLabel}
        hideTooltip={hideTooltip}
      />
      <SidebarButton
        icon={<Video className="h-5 w-5" />}
        label="Video"
        isActive={activeTab === "video"}
        onClick={() => handleTabClick("video")}
        colorClass="text-blue-400 hover:text-blue-300"
        showLabel={showLabel}
        hideTooltip={hideTooltip}
      />
      <SidebarButton
        icon={<Wand2 className="h-5 w-5" />}
        label="App Stealer"
        isActive={activeTab === "stealer"}
        onClick={() => handleTabClick("stealer")}
        colorClass="text-rose-400 hover:text-rose-300"
        showLabel={showLabel}
        hideTooltip={hideTooltip}
      />
      <SidebarButton
        icon={<DollarSign className="h-5 w-5" />}
        label="Payments"
        isActive={activeTab === "payments"}
        onClick={() => handleTabClick("payments")}
        colorClass="text-emerald-400 hover:text-emerald-300"
        showLabel={showLabel}
        hideTooltip={hideTooltip}
      />

      {/* Divider */}
      <div className="my-2 border-t border-border/30" />

      {/* Publish to App Store Button */}
      {showLabel || hideTooltip ? (
        <button
          onClick={() => setShowAppStoreDialog(true)}
          className={cn(
            "w-full flex items-center p-2.5 rounded-lg transition-all duration-200 hover:bg-blue-500/10",
            showLabel ? "justify-start gap-2.5" : "justify-center"
          )}
        >
          <img
            src="/brand-assets/apple-app-store.svg"
            alt="App Store"
            className="h-5 w-5"
          />
          {showLabel && <span className="text-xs font-medium text-blue-400">Publish</span>}
        </button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowAppStoreDialog(true)}
              className="w-full flex items-center p-2.5 rounded-lg transition-all duration-200 hover:bg-blue-500/10 justify-center"
            >
              <img
                src="/brand-assets/apple-app-store.svg"
                alt="App Store"
                className="h-5 w-5"
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            Publish to App Store
          </TooltipContent>
        </Tooltip>
      )}

      {/* More Actions Dropdown */}
      <DropdownMenu>
        {showLabel || hideTooltip ? (
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center p-2.5 rounded-lg transition-all duration-200 hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                showLabel ? "justify-start gap-2.5" : "justify-center"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              {showLabel && <span className="text-xs font-medium">More</span>}
            </button>
          </DropdownMenuTrigger>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-full flex items-center p-2.5 rounded-lg transition-all duration-200 hover:bg-muted/50 text-muted-foreground hover:text-foreground justify-center"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              More Actions
            </TooltipContent>
          </Tooltip>
        )}
        <DropdownMenuContent side="right" align="end" className="w-48">
          <DropdownMenuItem
            onClick={handleRestartDevServer}
            disabled={isRestarting}
            className="flex items-center gap-2"
          >
            <RotateCcw className={cn("h-4 w-4", isRestarting && "animate-spin")} />
            <span>Restart Dev Server</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleClearHistory}
            disabled={isClearing}
            className="flex items-center gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className={cn("h-4 w-4", isClearing && "animate-pulse")} />
            <span>Clear History</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const getTabTitle = () => {
    switch (activeTab) {
      case "code": return "Code Explorer";
      case "database": return "Database";
      case "envs": return "Environment Variables";
      case "payments": return "Payments";
      case "logs": return "Expo Logs";
      case "haptics": return "Haptics";
      case "api": return "API Models";
      case "images": return "Image Studio";
      case "audio": return "Audio Studio";
      case "video": return "Video Studio";
      case "stealer": return "App Stealer";
      default: return "";
    }
  };

  const dialogs = (
    <>
      {/* Publish to App Store Dialog */}
      <Dialog open={showAppStoreDialog} onOpenChange={setShowAppStoreDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img
                src="/brand-assets/apple-app-store.svg"
                alt="App Store"
                className="h-6 w-6"
              />
              Publish to App Store
            </DialogTitle>
            <DialogDescription className="text-left">
              {hasGitHubConnected
                ? "Launch your app to the App Store using Expo's EAS Submit service."
                : "Connect GitHub first to publish your app to the App Store."
              }
            </DialogDescription>
          </DialogHeader>

          {hasGitHubConnected ? (
            // GitHub connected - show launch instructions
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                  <span className="text-sm font-medium text-emerald-500">GitHub Connected</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Repository: <span className="font-mono text-foreground">{session?.githubRepository}</span>
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  To publish your app to the App Store:
                </p>
                <ol className="text-sm space-y-2 ml-4 list-decimal text-muted-foreground">
                  <li>Go to <strong className="text-foreground">launch.expo.dev</strong></li>
                  <li>Create a new project and paste your GitHub URL</li>
                  <li>Follow the guided setup process</li>
                  <li>Submit to the App Store!</li>
                </ol>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Your GitHub Repository URL</label>
                <div className="flex gap-2">
                  <Input
                    value={session?.githubRepositoryUrl || ""}
                    readOnly
                    className="font-mono text-xs bg-muted/30"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyRepoUrl}
                    className="flex-shrink-0"
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // GitHub not connected - prompt to connect
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <span className="text-amber-500 text-sm font-bold">!</span>
                  </div>
                  <span className="text-sm font-medium text-amber-500">GitHub Required</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  You need to connect your project to GitHub before publishing to the App Store.
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                Click the button below to open the GitHub dropdown in the navbar and connect your repository.
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowAppStoreDialog(false)}>
              Cancel
            </Button>
            {hasGitHubConnected ? (
              <Button onClick={handleOpenExpoLaunch} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <ExternalLink className="h-4 w-4" />
                Open launch.expo.dev
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setShowAppStoreDialog(false);
                  // Dispatch a custom event to open GitHub dropdown in navbar
                  window.dispatchEvent(new CustomEvent("open-github-dropdown"));
                }}
                className="gap-2 bg-zinc-700 hover:bg-zinc-600"
              >
                Connect GitHub First
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // When collapsed, show only icon strip
  if (!isExpanded) {
    return (
      <>
        <div className="h-full flex flex-col bg-background rounded-xl border border-border/50 shadow-sm overflow-hidden flex-shrink-0 w-[52px]">
          {renderSidebarButtons(false, false)}
        </div>
        {dialogs}
      </>
    );
  }

  // When expanded, show full panel with animation
  return (
    <>
      <div
        className={cn(
          "h-full flex bg-background rounded-xl border border-border/50 shadow-sm overflow-hidden flex-1 min-w-0",
          "transition-all duration-300 ease-out",
          isAnimating && "animate-in fade-in-0 slide-in-from-left-2"
        )}
      >
        {/* Icon strip */}
        <div className="w-[52px] flex-shrink-0 flex flex-col border-r border-border/50 bg-muted/20">
          {renderSidebarButtons(false)}
        </div>

        {/* Content panel with animation */}
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0 overflow-hidden",
            "transition-all duration-300 ease-out",
            isAnimating ? "opacity-0 translate-x-2" : "opacity-100 translate-x-0"
          )}
        >
          {/* Header with close button */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30 flex-shrink-0">
            <span className="text-sm font-medium truncate">
              {getTabTitle()}
            </span>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "code" && session && (
              <CodeTab session={session} onAddToPrompt={handleAddToPromptAndClose} />
            )}
            {activeTab === "database" && session && (
              <DatabaseTab session={session} refreshKey={refreshKey} onAddToPrompt={handleAddToPromptAndClose} />
            )}
            {activeTab === "envs" && <EnvsTab session={session} />}
            {activeTab === "payments" && <PaymentsTab sessionId={session?.sessionId} />}
            {activeTab === "logs" && session && (
              <LogsTab session={session} onAddToPrompt={handleAddToPromptAndClose} />
            )}
            {activeTab === "haptics" && (
              <HapticsTab onAddToPrompt={handleAddToPromptAndClose} />
            )}
            {activeTab === "api" && (
              <APITab onAddToPrompt={handleAddToPromptAndClose} />
            )}
            {activeTab === "images" && (
              <ImageStudioTab
                onAddToPrompt={handleAddToPromptAndClose}
                onAddToChat={(file) => {
                  onAddImageToChat?.(file);
                  handleClose();
                }}
              />
            )}
            {activeTab === "audio" && (
              <AudioStudioTab onAddToPrompt={handleAddToPromptAndClose} />
            )}
            {activeTab === "video" && (
              <VideoStudioTab onAddToPrompt={handleAddToPromptAndClose} />
            )}
            {activeTab === "stealer" && (
              <AppStealerTab
                session={session}
                onClose={handleClose}
              />
            )}
          </div>
        </div>
      </div>
      {dialogs}
    </>
  );
}
