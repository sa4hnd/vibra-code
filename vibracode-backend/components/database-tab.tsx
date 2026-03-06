"use client";

import { Database, ExternalLink, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Doc } from "@/convex/_generated/dataModel";
import { useState, useEffect } from "react";

interface DatabaseTabProps {
  session: Doc<"sessions">;
  refreshKey: number;
  onAddToPrompt?: (text: string) => void;
}

type DatabaseType = "prisma" | "convex" | null;

export default function DatabaseTab({ session, refreshKey, onAddToPrompt }: DatabaseTabProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseType>(null);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  // Check which database was selected for this session (using localStorage)
  useEffect(() => {
    const key = `database_type_${session?._id}`;
    const dbType = localStorage.getItem(key) as DatabaseType;
    setSelectedDatabase(dbType);
  }, [session?._id]);

  // Reset loaded state when URL changes
  useEffect(() => {
    setIsIframeLoaded(false);
  }, [session?.tunnelUrl, selectedDatabase]);

  // Get the database URL from tunnel URL
  const getDatabaseUrl = () => {
    if (!session?.tunnelUrl) return null;

    try {
      const url = new URL(session.tunnelUrl);
      const hostname = url.hostname;

      // Replace port in subdomain based on database type
      const port = selectedDatabase === "convex" ? "6790" : "5555";
      const newHostname = hostname.replace(/^\d+-/, `${port}-`);

      url.hostname = newHostname;
      url.port = '';

      // Add query parameter for Convex dashboard
      if (selectedDatabase === "convex") {
        url.searchParams.set('d', 'anonymous-agent');
      }

      return url.toString();
    } catch {
      return null;
    }
  };

  const databaseUrl = getDatabaseUrl();

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIsIframeLoaded(false);
    setIframeKey(prev => prev + 1);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleOpenExternal = () => {
    if (databaseUrl) {
      window.open(databaseUrl, "_blank");
    }
  };

  const handleSelectDatabase = (dbType: DatabaseType, prompt: string) => {
    // Add to prompt
    onAddToPrompt?.(prompt);

    // Mark database as selected for this session
    const key = `database_type_${session?._id}`;
    localStorage.setItem(key, dbType || "");
    setSelectedDatabase(dbType);
  };

  // No database selected yet - show database options
  if (!selectedDatabase) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center max-w-2xl mx-auto w-full">
          <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center">
            <Database className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-4">Choose Your Database</h3>
          <p className="text-muted-foreground mb-8 text-base">
            Select a database solution to enable data persistence in your app.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Prisma Option */}
            <button
              onClick={() =>
                handleSelectDatabase(
                  "prisma",
                  "Enable backend with Prisma database. Create the full backend setup: schema.prisma, backend/hono.ts, tRPC routes, database client, and start Prisma Studio on port 5555"
                )
              }
              className="group border-2 border-border hover:border-primary/50 rounded-xl p-6 transition-all hover:shadow-lg text-left"
            >
              <div className="w-12 h-12 mb-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
                <Database className="h-6 w-6 text-white" />
              </div>
              <h4 className="font-semibold mb-2 text-lg">Prisma + PostgreSQL</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Type-safe ORM with PostgreSQL database. Includes Prisma Studio for visual database management.
              </p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Type-safe database queries</li>
                <li>• Visual database editor</li>
                <li>• Automatic migrations</li>
                <li>• Production-ready</li>
              </ul>
            </button>

            {/* Convex Option */}
            <button
              onClick={() =>
                handleSelectDatabase(
                  "convex",
                  "Enable backend with Convex database. Set up Convex backend with real-time sync, schema definitions, queries, mutations, and start Convex dashboard on port 6790"
                )
              }
              className="group border-2 border-border hover:border-primary/50 rounded-xl p-6 transition-all hover:shadow-lg text-left"
            >
              <div className="w-12 h-12 mb-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
                <Database className="h-6 w-6 text-white" />
              </div>
              <h4 className="font-semibold mb-2 text-lg">Convex</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Real-time database with built-in backend. Live queries and automatic synchronization.
              </p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Real-time data sync</li>
                <li>• Built-in authentication</li>
                <li>• Serverless functions</li>
                <li>• Zero infrastructure</li>
              </ul>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Database selected but no tunnel URL yet
  if (!databaseUrl) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center max-w-md mx-auto">
          <Database className="h-16 w-16 mx-auto text-muted-foreground mb-6" />
          <h3 className="text-xl font-semibold mb-4">
            {selectedDatabase === "convex" ? "Convex Dashboard" : "Prisma Studio"}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {selectedDatabase === "convex" ? "Convex dashboard" : "Prisma Studio"} will be available once your app is running.
          </p>
          <p className="text-xs text-muted-foreground/60 mb-4">
            Port: {selectedDatabase === "convex" ? "6790" : "5555"}
          </p>
          <button
            onClick={() => {
              const key = `database_type_${session?._id}`;
              localStorage.removeItem(key);
              setSelectedDatabase(null);
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 underline"
          >
            Change database selection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" key={refreshKey}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-medium text-muted-foreground">
            {selectedDatabase === "convex" ? "Convex Dashboard" : "Prisma Studio"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleOpenExternal}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Iframe Preview */}
      <div className="flex-1 min-h-0 bg-background relative">
        {/* Loading overlay */}
        {!isIframeLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="size-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <Database className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-1">
                  Loading {selectedDatabase === "convex" ? "Convex Dashboard" : "Prisma Studio"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Please wait while the dashboard loads...
                </p>
              </div>
            </div>
          </div>
        )}

        <iframe
          key={iframeKey}
          src={databaseUrl}
          className="w-full h-full border-0"
          title={selectedDatabase === "convex" ? "Convex Dashboard" : "Prisma Studio"}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          onLoad={() => setIsIframeLoaded(true)}
        />
      </div>
    </div>
  );
}
