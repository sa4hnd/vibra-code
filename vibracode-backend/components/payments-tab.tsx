"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  Check,
  Loader2,
  Unlink,
  ExternalLink,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";

interface PaymentsTabProps {
  sessionId?: string;
}

interface ConnectionStatus {
  connected: boolean;
  isExpired?: boolean;
  scope?: string;
  connectedAt?: number;
}

export function PaymentsTab({ sessionId }: PaymentsTabProps) {
  const { user, isLoaded } = useUser();
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
                setConnectionStatus(data);
                if (data.connected) {
                  toast.success("RevenueCat connected successfully!");

                  // Automatically set up MCP for this session
                  if (sessionId) {
                    await setupMcp();
                  }

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

  // Loading state
  if (isCheckingConnection) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking connection...</p>
        </div>
      </div>
    );
  }

  // Connected state
  if (connectionStatus?.connected) {
    return (
      <div className="p-4 space-y-6">
        {/* Connection status card */}
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium">RevenueCat</p>
                <div className="flex items-center gap-1.5 text-sm">
                  {connectionStatus.isExpired ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="text-amber-500">Token expired</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-emerald-500">Connected</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Scopes */}
          {connectionStatus.scope && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Permissions:</span>{" "}
              <span className="font-mono text-[10px]">{connectionStatus.scope}</span>
            </div>
          )}
        </div>

        {/* AI Integration card */}
        <div className="bg-zinc-900/50 border border-border/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-400" />
              <p className="font-medium">AI Integration</p>
            </div>
            {mcpSetupComplete ? (
              <span className="text-xs text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full">
                <Check className="h-3 w-3" /> Active
              </span>
            ) : (
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded-full">Not set up</span>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {mcpSetupComplete
              ? "The AI can help you manage products, entitlements, offerings, and paywalls."
              : "Enable AI to help manage your RevenueCat project."}
          </p>

          {!mcpSetupComplete && sessionId && (
            <Button
              onClick={setupMcp}
              disabled={isSettingUpMcp || connectionStatus.isExpired}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            >
              {isSettingUpMcp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Setting up...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Enable for AI
                </>
              )}
            </Button>
          )}

          {mcpSetupComplete && (
            <p className="text-xs text-amber-500/80 bg-amber-500/10 p-2 rounded-lg">
              Send a new message to use RevenueCat tools
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {connectionStatus.isExpired && (
            <Button
              onClick={handleRefreshTokens}
              disabled={isRefreshing}
              variant="outline"
              className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh Tokens
            </Button>
          )}

          <a
            href="https://app.revenuecat.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Open RevenueCat Dashboard
            <ExternalLink className="h-4 w-4" />
          </a>

          <Button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            variant="ghost"
            className="w-full text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
          >
            {isDisconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Unlink className="h-4 w-4 mr-2" />
            )}
            Disconnect RevenueCat
          </Button>
        </div>
      </div>
    );
  }

  // Not connected state
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="max-w-sm w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <DollarSign className="h-8 w-8 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Connect RevenueCat</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Enable AI-powered in-app purchase management
            </p>
          </div>
        </div>

        {/* Features list */}
        <div className="bg-zinc-900/50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
            What you can do with AI
          </p>
          <ul className="space-y-2">
            {[
              "Create & manage products",
              "Configure entitlements",
              "Design offerings & paywalls",
              "Manage subscription plans",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Connect button */}
        <Button
          onClick={handleConnectRevenueCat}
          disabled={isConnecting}
          className="w-full gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white h-11"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <DollarSign className="h-5 w-5" />
              Connect RevenueCat
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground/60 text-center">
          You'll be redirected to RevenueCat to authorize
        </p>
      </div>
    </div>
  );
}
