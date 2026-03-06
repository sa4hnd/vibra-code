"use client";

import { useState, useEffect } from "react";
import { Github, ExternalLink, Check, Loader2, Plus, RotateCcw, Lock, Globe, ChevronDown, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Doc } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";
import {
  checkGitHubConnection,
  createAndPushToGitHub,
  generateRepoName,
  retryGitHubPush,
  disconnectGitHub,
  clearSessionGitHub,
} from "@/app/actions/github-push";
import { cn } from "@/lib/utils";

interface GitHubIntegrationProps {
  session: Doc<"sessions">;
}

export function GitHubIntegration({ session }: GitHubIntegrationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [repoName, setRepoName] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);

  // Listen for custom event to open the dropdown
  useEffect(() => {
    const handleOpenGitHubDropdown = () => {
      setIsOpen(true);
    };

    window.addEventListener("open-github-dropdown", handleOpenGitHubDropdown);
    return () => {
      window.removeEventListener("open-github-dropdown", handleOpenGitHubDropdown);
    };
  }, []);

  // Check GitHub connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      setIsCheckingConnection(true);
      const result = await checkGitHubConnection();
      setIsConnected(result.isConnected);
      setUsername(result.username || null);
      setIsCheckingConnection(false);
    };
    checkConnection();
  }, []);

  // Generate default repo name from session name
  useEffect(() => {
    const generateName = async () => {
      if (session.name && !repoName) {
        const name = await generateRepoName(session.name);
        setRepoName(name);
      }
    };
    generateName();
  }, [session.name, repoName]);

  const handleConnectGitHub = () => {
    const callbackUrl = encodeURIComponent(pathname);
    router.push(`/auth/github?callbackUrl=${callbackUrl}`);
  };

  const handleCreateAndPush = async () => {
    if (!session.sessionId || !repoName) return;

    setIsLoading(true);
    try {
      const result = await createAndPushToGitHub({
        sessionId: session.sessionId,
        convexId: session._id,
        repoName: repoName.trim(),
        isPrivate,
      });

      if (result.success) {
        toast.success("Repository created! Pushing code...");
        setIsOpen(false);
      } else {
        toast.error(result.error || "Failed to create repository");
      }
    } catch {
      toast.error("Failed to create repository");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetryPush = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session.sessionId || !session.githubRepository) return;

    setIsRetrying(true);
    try {
      const result = await retryGitHubPush({
        sessionId: session.sessionId,
        convexId: session._id,
        repository: session.githubRepository,
      });

      if (result.success) {
        toast.success("Retrying push...");
      } else {
        toast.error(result.error || "Failed to retry");
      }
    } catch {
      toast.error("Failed to retry");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleUnlinkGitHub = async () => {
    setIsUnlinking(true);
    try {
      // If session has a repo connected, clear it first
      if (session.githubRepository) {
        const clearResult = await clearSessionGitHub({ convexId: session._id });
        if (!clearResult.success) {
          toast.error(clearResult.error || "Failed to clear repository");
          return;
        }
      }

      // Then disconnect GitHub credentials
      const result = await disconnectGitHub();
      if (result.success) {
        setIsConnected(false);
        setUsername(null);
        toast.success("GitHub disconnected. You can now connect a different account or create a new repo.");
        setIsOpen(false);
      } else {
        toast.error(result.error || "Failed to disconnect GitHub");
      }
    } catch {
      toast.error("Failed to disconnect GitHub");
    } finally {
      setIsUnlinking(false);
    }
  };

  // Status indicator dot
  const StatusDot = ({ status }: { status?: string }) => {
    if (status === "in_progress") {
      return (
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
        </span>
      );
    }
    if (status === "completed") {
      return (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
      );
    }
    if (status === "failed") {
      return (
        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
      );
    }
    return null;
  };

  // If repo is connected, show compact status button
  if (session.githubRepository) {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
              "bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50",
              "text-zinc-300 hover:text-zinc-100",
              "focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-1 focus:ring-offset-background"
            )}
          >
            <div className="relative">
              <Github className="h-3.5 w-3.5" />
              <StatusDot status={session.githubPushStatus} />
            </div>
            <span className="max-w-[80px] truncate hidden sm:inline">
              {session.githubRepository.split("/")[1]}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <div className="p-3 space-y-3">
            {/* Repository info */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Repository</p>
                <a
                  href={session.githubRepositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors group"
                >
                  <Github className="h-4 w-4 shrink-0" />
                  <span className="truncate">{session.githubRepository}</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </a>
              </div>
            </div>

            <DropdownMenuSeparator />

            {/* Status section */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Sync Status</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {session.githubPushStatus === "in_progress" && (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                      <span className="text-sm text-amber-500">Pushing...</span>
                    </>
                  )}
                  {session.githubPushStatus === "completed" && (
                    <>
                      <div className="h-4 w-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Check className="h-3 w-3 text-emerald-500" />
                      </div>
                      <span className="text-sm text-emerald-500">Synced</span>
                    </>
                  )}
                  {session.githubPushStatus === "failed" && (
                    <>
                      <div className="h-4 w-4 rounded-full bg-red-500/20 flex items-center justify-center">
                        <span className="text-red-500 text-xs font-bold">!</span>
                      </div>
                      <span className="text-sm text-red-500">Push failed</span>
                    </>
                  )}
                  {!session.githubPushStatus && (
                    <>
                      <div className="h-4 w-4 rounded-full bg-zinc-500/20 flex items-center justify-center">
                        <span className="text-zinc-500 text-xs">—</span>
                      </div>
                      <span className="text-sm text-muted-foreground">Not synced</span>
                    </>
                  )}
                </div>

                {session.githubPushStatus === "failed" && (
                  <button
                    onClick={handleRetryPush}
                    disabled={isRetrying}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all",
                      "bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isRetrying ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Retry
                  </button>
                )}
              </div>
            </div>

            {/* Auto-sync info */}
            <div className="pt-1">
              <p className="text-[10px] text-muted-foreground/60">
                Auto-sync enabled • Pushes after each update
              </p>
            </div>

            <DropdownMenuSeparator />

            {/* Disconnect option */}
            <button
              onClick={handleUnlinkGitHub}
              disabled={isUnlinking || session.githubPushStatus === "in_progress"}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium transition-all",
                "text-zinc-500 hover:text-red-400 hover:bg-red-500/10",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isUnlinking ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Unlink className="h-3 w-3" />
              )}
              Disconnect GitHub
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // No repo connected - show setup button
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
            "bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 border-dashed",
            "text-zinc-400 hover:text-zinc-200",
            "focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-1 focus:ring-offset-background"
          )}
        >
          <Github className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Push to GitHub</span>
          <Plus className="h-3 w-3 opacity-50 sm:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="p-4 space-y-4">
          {isCheckingConnection ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !isConnected ? (
            // Not connected state
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Github className="h-5 w-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Connect GitHub</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Push your app to a repository
                  </p>
                </div>
              </div>
              <Button
                onClick={handleConnectGitHub}
                className="w-full gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
              >
                <Github className="h-4 w-4" />
                Connect Account
              </Button>
            </div>
          ) : (
            // Connected state - show repo creation form
            <div className="space-y-4">
              {/* Connected badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="h-3 w-3 text-emerald-500" />
                  </div>
                  <span className="text-muted-foreground">
                    Signed in as <span className="text-foreground font-medium">@{username}</span>
                  </span>
                </div>
                <button
                  onClick={handleUnlinkGitHub}
                  disabled={isUnlinking || isLoading}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all",
                    "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  title="Disconnect GitHub"
                >
                  {isUnlinking ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Unlink className="h-3 w-3" />
                  )}
                  Disconnect
                </button>
              </div>

              <DropdownMenuSeparator />

              {/* Repo name input */}
              <div className="space-y-2">
                <DropdownMenuLabel className="px-0 py-0 text-xs text-muted-foreground font-normal">
                  Repository name
                </DropdownMenuLabel>
                <Input
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-app"
                  disabled={isLoading}
                  className="h-9 text-sm bg-zinc-900/50 border-zinc-700 focus:border-zinc-600"
                />
              </div>

              {/* Visibility toggle */}
              <div className="space-y-2">
                <DropdownMenuLabel className="px-0 py-0 text-xs text-muted-foreground font-normal">
                  Visibility
                </DropdownMenuLabel>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    disabled={isLoading}
                    className={cn(
                      "flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all",
                      isPrivate
                        ? "bg-zinc-700 text-zinc-100 ring-1 ring-zinc-600"
                        : "bg-zinc-900/50 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50"
                    )}
                  >
                    <Lock className="h-3 w-3" />
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(false)}
                    disabled={isLoading}
                    className={cn(
                      "flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all",
                      !isPrivate
                        ? "bg-zinc-700 text-zinc-100 ring-1 ring-zinc-600"
                        : "bg-zinc-900/50 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50"
                    )}
                  >
                    <Globe className="h-3 w-3" />
                    Public
                  </button>
                </div>
              </div>

              {/* Create button */}
              <Button
                onClick={handleCreateAndPush}
                disabled={isLoading || !repoName.trim()}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create & Push
                  </>
                )}
              </Button>

              {/* Info text */}
              <p className="text-[10px] text-muted-foreground/60 text-center">
                Auto-sync will be enabled after creation
              </p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
