"use client";

import { useQuery } from "convex/react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import Chat from "@/components/chat";
import Preview from "@/components/preview";
import { LeftSidebar } from "@/components/session/left-sidebar";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useResumeSession } from "@/lib/hooks/use-resume-session";
import { cn } from "@/lib/utils";

export default function ClientPage({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useUser();
  // Validate that id is a valid Convex document ID format (32 alphanumeric characters)
  const isValidConvexId = id && /^[a-z0-9]{32}$/.test(id);

  // Use Convex query to get session data - requires createdBy for security
  const session = useQuery(
    api.sessions.getById,
    isValidConvexId && user?.id ? { id: id as Id<"sessions">, createdBy: user.id } : "skip"
  );

  const { resumeSession, isResuming, error } = useResumeSession();
  // Use ref to track if we've attempted resume - prevents re-triggering on Convex updates
  const hasMountedRef = useRef(false);
  const sendMessageRef = useRef<((message: string) => void) | null>(null);
  const addToPromptRef = useRef<((text: string) => void) | null>(null);
  const addImageToChatRef = useRef<((file: File) => void) | null>(null);
  const [showError, setShowError] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  // Resizable state
  const [previewWidth, setPreviewWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize callback to prevent infinite loops
  const handleSidebarExpandedChange = useCallback((expanded: boolean) => {
    setIsSidebarExpanded(expanded);
  }, []);

  // Handle sending messages from sidebar
  const handleSendMessage = useCallback((message: string) => {
    if (sendMessageRef.current) {
      sendMessageRef.current(message);
    }
  }, []);

  // Handle adding text to prompt from sidebar
  const handleAddToPrompt = useCallback((text: string) => {
    if (addToPromptRef.current) {
      addToPromptRef.current(text);
    }
  }, []);

  // Handle adding image to chat from sidebar
  const handleAddImageToChat = useCallback((file: File) => {
    if (addImageToChatRef.current) {
      addImageToChatRef.current(file);
    }
  }, []);

  // Handle resize drag
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;

    // Calculate new preview width as percentage
    const mouseX = e.clientX - containerRect.left;
    const newPreviewWidth = ((containerWidth - mouseX) / containerWidth) * 100;

    // Minimum preview width: 400px for phone frame
    const minPreviewWidthPx = 400;
    const minPreviewWidthPercent = (minPreviewWidthPx / containerWidth) * 100;

    // Maximum preview width: 80% of container
    const maxPreviewWidthPercent = 80;

    // Clamp the width
    const clampedWidth = Math.max(minPreviewWidthPercent, Math.min(maxPreviewWidthPercent, newPreviewWidth));

    setPreviewWidth(clampedWidth);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Auto-resume session ONLY ONCE on initial mount when session is available
  // This prevents resume from being called on every Convex data update
  useEffect(() => {
    const sessionId = session?.sessionId;
    // Only resume if we have a session ID and this is the first mount
    if (sessionId && !hasMountedRef.current) {
      console.log('🔄 Auto-resuming session (mount):', sessionId);
      hasMountedRef.current = true;
      resumeSession(sessionId);
    }
  }, [session?.sessionId]);

  // Show error after resume attempt completes with error
  useEffect(() => {
    if (error && hasMountedRef.current && !isResuming) {
      setShowError(true);
    }
  }, [error, isResuming]);

  // Show loading state while resuming
  if (isResuming) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center mt-20">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Resuming session...</p>
        </div>
      </div>
    );
  }

  // Show error state if resume failed
  if (showError && error) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center mt-20">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm">
          <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold">Failed to resume session</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <button
            onClick={() => {
              setShowError(false);
              hasMountedRef.current = false;
              if (session?.sessionId) {
                hasMountedRef.current = true;
                resumeSession(session.sessionId);
              }
            }}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors duration-200 shadow-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show loading state while session is being fetched
  if (session === undefined) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center mt-20">
        <div className="flex flex-col items-center gap-4">
          <div className="size-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Loading session...</p>
        </div>
      </div>
    );
  }

  // Show error state if session doesn't exist
  if (session === null) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center mt-20">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center">
            <span className="text-2xl">🔍</span>
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold">Session not found</p>
            <p className="text-sm text-muted-foreground">
              The session you're looking for doesn't exist or has been deleted.
            </p>
            <p className="text-xs text-muted-foreground/60 font-mono">
              ID: {id}
            </p>
          </div>
          <button
            onClick={() => router.push('/sessions')}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors duration-200 shadow-sm"
          >
            View All Sessions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col lg:flex-row h-[calc(100vh-80px)] gap-3 p-2 sm:p-4 mt-16 overflow-hidden">
      {/* Left Sidebar */}
      <LeftSidebar
        session={session}
        onExpandedChange={handleSidebarExpandedChange}
        onSendMessage={handleSendMessage}
        onAddToPrompt={handleAddToPrompt}
        onAddImageToChat={handleAddImageToChat}
      />

      {/* Chat - hidden when sidebar is expanded on desktop, but kept mounted so refs work */}
      <div
        className={cn(
          "flex-1 min-w-0 max-w-full h-[50%] lg:h-full overflow-x-hidden",
          isSidebarExpanded && "lg:hidden"
        )}
        style={{ width: `${100 - previewWidth}%` }}
      >
        <Chat
          session={session}
          onSendMessageRef={sendMessageRef}
          onAddToPromptRef={addToPromptRef}
          onAddImageToChat={addImageToChatRef}
        />
      </div>

      {/* Resize Handle */}
      <div
        className="hidden lg:block w-1 hover:w-2 bg-border hover:bg-primary/50 cursor-col-resize transition-all flex-shrink-0 relative group"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* Preview - responsive width, always visible */}
      <div
        className="flex-shrink-0 h-[50%] lg:h-full"
        style={{ width: `${previewWidth}%` }}
      >
        <Preview session={session} previewWidth={previewWidth} />
      </div>
    </div>
  );
}
