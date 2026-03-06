"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  Check,
  Loader2,
  ChevronDown,
  Unlink,
  ExternalLink,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";

interface RevenueCatIntegrationProps {
  sessionId?: string;
}

interface ConnectionStatus {
  connected: boolean;
  isExpired?: boolean;
  scope?: string;
  connectedAt?: number;
}

export function RevenueCatIntegration({ sessionId }: RevenueCatIntegrationProps) {
  const { user, isLoaded } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingUpMcp, setIsSettingUpMcp] = useState(false);
  const [mcpSetupComplete, setMcpSetupComplete] = useState(false);

  // Check RevenueCat connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (!isLoaded || !user?.id) return;

      setIsCheckingConnection(true);
      try {
        const response = await fetch(
          `/api/oauth/revenuecat?clerkId=${encodeURIComponent(user.id)}`
        );
        if (response.ok) {
          const data = await response.json();
          setConnectionStatus(data);
        } else {
          setConnectionStatus({ connected: false });
        }
      } catch (error) {
        console.error("Error checking RevenueCat connection:", error);
        setConnectionStatus({ connected: false });
      } finally {
        setIsCheckingConnection(false);
      }
    };

    checkConnection();
  }, [isLoaded, user?.id]);

  // Set up MCP when connected and sessionId is available
  const setupMcp = async () => {
    if (!user?.id || !sessionId) return;

    setIsSettingUpMcp(true);
    try {
      const response = await fetch("/api/oauth/revenuecat/setup-mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkId: user.id,
          sessionId,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMcpSetupComplete(true);
        toast.success("RevenueCat enabled! Send a new message to use payment tools.");
      } else if (data.needsReauth) {
        setConnectionStatus({ connected: false });
        toast.error("Session expired. Please reconnect your RevenueCat account.");
      } else {
        throw new Error(data.error || "Failed to set up MCP");
      }
    } catch (error) {
      console.error("Error setting up MCP:", error);
      toast.error("Failed to enable RevenueCat for AI. Try again.");
    } finally {
      setIsSettingUpMcp(false);
    }
  };

  const handleConnectRevenueCat = async () => {
    if (!user?.id) {
      toast.error("Please sign in to connect RevenueCat");
      return;
    }

    setIsConnecting(true);
    try {
      const response = await fetch("/api/oauth/revenuecat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkId: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate OAuth");
      }

      const { authUrl } = await response.json();

      // Open OAuth in popup window
      const popup = window.open(
        authUrl,
        "revenuecat-oauth",
        "width=600,height=700,scrollbars=yes,resizable=yes"
      );

      if (!popup) {
        toast.error("Please allow popups for this site to connect to RevenueCat");
        setIsConnecting(false);
        return;
      }

      popup.focus();

      // Poll for popup close and connection status
      const pollTimer = setInterval(async () => {
        if (popup.closed) {
          clearInterval(pollTimer);

          // Wait a moment for the callback to finish processing
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Re-check connection status with retries
          let retries = 3;
          while (retries > 0) {
            try {
              const checkResponse = await fetch(
                `/api/oauth/revenuecat?clerkId=${encodeURIComponent(user.id)}`
              );
              if (checkResponse.ok) {
                const data = await checkResponse.json();
                console.log('RevenueCat connection check:', data);
                setConnectionStatus(data);
                if (data.connected) {
                  toast.success("RevenueCat connected successfully!");

                  // Automatically set up MCP for this session
                  if (sessionId) {
                    await setupMcp();
                  }

                  setIsOpen(false);
                  setIsConnecting(false);
                  return;
                }
              }
            } catch (error) {
              console.error('Error checking connection:', error);
            }
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          setIsConnecting(false);
        }
      }, 500);
    } catch (error) {
      console.error("Error connecting RevenueCat:", error);
      toast.error("Failed to connect RevenueCat");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user?.id) return;

    setIsDisconnecting(true);
    try {
      const response = await fetch("/api/oauth/revenuecat/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId: user.id }),
      });

      if (response.ok) {
        setConnectionStatus({ connected: false });
        setMcpSetupComplete(false);
        toast.success("RevenueCat disconnected");
        setIsOpen(false);
      } else {
        throw new Error("Failed to disconnect");
      }
    } catch (error) {
      console.error("Error disconnecting RevenueCat:", error);
      toast.error("Failed to disconnect RevenueCat");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleRefreshTokens = async () => {
    if (!user?.id) return;

    setIsRefreshing(true);
    try {
      const response = await fetch("/api/oauth/revenuecat/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkId: user.id }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setConnectionStatus((prev) => ({
          ...prev!,
          connected: true,
          isExpired: false,
        }));
        toast.success("Tokens refreshed successfully");
      } else if (data.needsReauth) {
        setConnectionStatus({ connected: false });
        toast.error("Session expired. Please reconnect your account.");
      } else {
        throw new Error(data.error || "Failed to refresh tokens");
      }
    } catch (error) {
      console.error("Error refreshing tokens:", error);
      toast.error("Failed to refresh tokens");
    } finally {
      setIsRefreshing(false);
    }
  };

  // If connected, show compact status button
  if (connectionStatus?.connected) {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all",
              "bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30",
              connectionStatus.isExpired
                ? "text-amber-400"
                : "text-purple-400 hover:text-purple-300",
              "focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-1 focus:ring-offset-background"
            )}
          >
            <div className="relative">
              <DollarSign className="h-3.5 w-3.5" />
              {connectionStatus.isExpired ? (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-background" />
              ) : (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
              )}
            </div>
            <span className="hidden sm:inline">RevenueCat</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <div className="p-3 space-y-3">
            {/* Connection status */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <div className="flex items-center gap-2">
                  {connectionStatus.isExpired ? (
                    <>
                      <div className="h-4 w-4 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <span className="text-amber-500 text-xs font-bold">!</span>
                      </div>
                      <span className="text-sm text-amber-500">Token expired</span>
                    </>
                  ) : (
                    <>
                      <div className="h-4 w-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <Check className="h-3 w-3 text-emerald-500" />
                      </div>
                      <span className="text-sm text-emerald-500">Connected</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Scopes */}
            {connectionStatus.scope && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Permissions</p>
                <p className="text-[10px] text-zinc-500 font-mono truncate">
                  {connectionStatus.scope}
                </p>
              </div>
            )}

            <DropdownMenuSeparator />

            {/* MCP info */}
            <div className="bg-zinc-900/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-300">AI Integration</p>
                {mcpSetupComplete ? (
                  <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500">Not set up</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-500">
                {mcpSetupComplete
                  ? "The AI can help you manage products, entitlements, offerings, and paywalls."
                  : "Enable AI to help manage your RevenueCat project."}
              </p>
              {!mcpSetupComplete && sessionId && (
                <Button
                  size="sm"
                  onClick={setupMcp}
                  disabled={isSettingUpMcp || connectionStatus.isExpired}
                  className="w-full mt-2 h-7 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                >
                  {isSettingUpMcp ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Setting up...
                    </>
                  ) : (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      Enable for AI
                    </>
                  )}
                </Button>
              )}
              {mcpSetupComplete && (
                <p className="text-[10px] text-amber-500/80 mt-2">
                  Send a new message to use RevenueCat tools
                </p>
              )}
            </div>

            <DropdownMenuSeparator />

            {/* Actions */}
            <div className="flex gap-2">
              {connectionStatus.isExpired && (
                <button
                  onClick={handleRefreshTokens}
                  disabled={isRefreshing}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-all",
                    "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Refresh
                </button>
              )}
              <button
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-all",
                  "text-zinc-500 hover:text-red-400 hover:bg-red-500/10",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isDisconnecting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Unlink className="h-3 w-3" />
                )}
                Disconnect
              </button>
            </div>

            {/* RevenueCat dashboard link */}
            <a
              href="https://app.revenuecat.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors"
            >
              Open RevenueCat Dashboard
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Not connected - show setup button
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
          <DollarSign className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Payments</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="p-4 space-y-4">
          {isCheckingConnection ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium">Connect RevenueCat</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enable AI-powered in-app purchase management
                  </p>
                </div>
              </div>

              {/* Features list */}
              <div className="bg-zinc-900/50 rounded-lg p-3 space-y-2">
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                  What you can do with AI
                </p>
                <ul className="text-xs text-zinc-500 space-y-1">
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-emerald-500" />
                    Create & manage products
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-emerald-500" />
                    Configure entitlements
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-emerald-500" />
                    Design offerings & paywalls
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-emerald-500" />
                    Manage subscription plans
                  </li>
                </ul>
              </div>

              <Button
                onClick={handleConnectRevenueCat}
                disabled={isConnecting}
                className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4" />
                    Connect RevenueCat
                  </>
                )}
              </Button>

              <p className="text-[10px] text-muted-foreground/60 text-center">
                You'll be redirected to RevenueCat to authorize
              </p>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
