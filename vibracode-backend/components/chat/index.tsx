import ChatForm from "./chat-form";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { ScrollArea } from "@/components/ui/scroll-area";
import Message, { processMessagesIntoGroups, GroupedMessage, GroupedItem } from "./message";
import { TextShimmer } from "../ui/text-shimmer";
import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { runAgentAction } from "@/app/actions/vibrakit";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

import { ClaudeModel } from "./model-selector";

interface Todo {
  id: string;
  content: string;
  status: string;
  priority: string;
}

// Helper function to extract the latest todos from assistant messages
function extractLatestTodos(messages: Doc<"messages">[]): Todo[] {
  // Find the most recent assistant message with todos
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (
      message.role === "assistant" &&
      message.todos &&
      message.todos.length > 0
    ) {
      return message.todos;
    }
  }
  return [];
}

// Helper function to calculate progress based on todo status
function calculateProgress(todos: Todo[]): number {
  if (todos.length === 0) return 0;
  const completedCount = todos.filter(
    (todo) =>
      todo.status.toLowerCase() === "completed" ||
      todo.status.toLowerCase() === "done"
  ).length;
  return Math.round((completedCount / todos.length) * 100);
}

// Helper function to get completed todo count
function getCompletedCount(todos: Todo[]): number {
  return todos.filter(
    (todo) =>
      todo.status.toLowerCase() === "completed" ||
      todo.status.toLowerCase() === "done"
  ).length;
}

// Round progress bar component
function RoundProgress({
  progress,
  completed,
  total,
}: {
  progress: number;
  completed: number;
  total: number;
}) {
  const circumference = 2 * Math.PI * 8; // radius of 8
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex items-center justify-center">
      <span className="text-xs font-medium text-muted-foreground mr-1">
        {completed}/{total}
      </span>
      <div className="relative w-4 h-4">
        <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 20 20">
          <circle
            cx="10"
            cy="10"
            r="8"
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            className="text-muted-foreground/30"
          />
          <circle
            cx="10"
            cy="10"
            r="8"
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="text-green-500 transition-all duration-300 ease-in-out"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

export default function Chat({
  session,
  onSendMessageRef,
  onAddToPromptRef,
  onAddImageToChat
}: {
  session: Doc<"sessions">;
  onSendMessageRef?: React.MutableRefObject<((message: string) => void) | null>;
  onAddToPromptRef?: React.MutableRefObject<((text: string) => void) | null>;
  onAddImageToChat?: React.MutableRefObject<((file: File) => void) | null>;
}) {
  const { user } = useUser();
  const addMessage = useMutation(api.messages.add);
  const messages = useQuery(api.messages.getBySession, {
    sessionId: session._id,
  });

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isStoppingAgent, setIsStoppingAgent] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [externalImages, setExternalImages] = useState<File[]>([]);

  // Determine if agent is currently running based on session status
  const isAgentRunning = session.status === "CUSTOM";

  // Handle stopping the running agent
  const handleStopAgent = useCallback(async () => {
    if (!session.sessionId || isStoppingAgent) return;

    setIsStoppingAgent(true);
    try {
      const response = await fetch("/api/session/stop-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error("Failed to stop agent:", result.error);
        toast.error("Failed to stop agent");
      } else {
        toast.success("Agent stopped");
      }
    } catch (error) {
      console.error("Error stopping agent:", error);
      toast.error("Error stopping agent");
    } finally {
      setIsStoppingAgent(false);
    }
  }, [session.sessionId, isStoppingAgent]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current && messages) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [messages]);

  const handleSubmit = async (message: string, _repository?: unknown, imageData?: {fileName: string, path: string, storageId: string} | null, _template?: string, model?: ClaudeModel) => {
    if (isSendingMessage) return;

    setIsSendingMessage(true);

    try {
      // Use the imageData directly if provided, don't extract from message
      let extractedImageData = undefined;
      let cleanMessage = message;

      if (imageData) {
        // Use the imageData directly from the form
          extractedImageData = {
            fileName: imageData.fileName,
            path: imageData.path,
            storageId: imageData.storageId as Id<"_storage"> | undefined,
          };
        // Keep the full message with image path for AI, but frontend will hide it
        cleanMessage = message;
      } else {
        // Fallback: Extract image data from message if present
        const imageMatch = message.match(/\[Image: (.+?) at (\/tmp\/.+?)\]/);
        if (imageMatch) {
          const fileName = imageMatch[1];
          const path = imageMatch[2];
          cleanMessage = message.replace(/\[Image: .+? at \/tmp\/.+?\]/, '').trim();

          extractedImageData = {
            fileName,
            path,
            storageId: undefined, // No storageId from message extraction
          };
        }
      }

      // First add the message to the database
      const messageId = await addMessage({
        sessionId: session._id as Id<"sessions">,
        role: "user",
        content: cleanMessage,
        image: extractedImageData,
      });

      // Then run the agent action
      try {
        await runAgentAction({
          sessionId: session.sessionId!,
          id: session._id,
          message: cleanMessage,
          repository: session.repository,
          token: "", // Token will be retrieved in the action using Clerk
          model: model || "claude-opus-4-5-20251101",
        });
      } catch (agentError) {
        console.error("Error running agent:", agentError);
        toast.error("Failed to process message. Please try again.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Keep a ref to the latest handleSubmit to avoid stale closures
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  // Expose sendMessage function through ref for parent components
  useEffect(() => {
    if (onSendMessageRef) {
      onSendMessageRef.current = (message: string) => {
        handleSubmitRef.current(message);
      };
    }
    return () => {
      if (onSendMessageRef) {
        onSendMessageRef.current = null;
      }
    };
  }, [onSendMessageRef]);

  // Expose addToPrompt function through ref for parent components
  useEffect(() => {
    if (onAddToPromptRef) {
      onAddToPromptRef.current = (text: string) => {
        setPromptText(prev => prev + text);
      };
    }
    return () => {
      if (onAddToPromptRef) {
        onAddToPromptRef.current = null;
      }
    };
  }, [onAddToPromptRef]);

  // Expose addImageToChat function through ref for parent components
  useEffect(() => {
    if (onAddImageToChat) {
      onAddImageToChat.current = (file: File) => {
        setExternalImages(prev => [...prev, file]);
      };
    }
    return () => {
      if (onAddImageToChat) {
        onAddImageToChat.current = null;
      }
    };
  }, [onAddImageToChat]);

  // Process messages into groups for better display (like NewOnboardingScreen15)
  // Must be called unconditionally to satisfy React's Rules of Hooks
  const groups = useMemo(() => {
    if (!messages) return [];
    return processMessagesIntoGroups(messages);
  }, [messages]);

  // Find the latest expandable group (read, edit, bash)
  const latestExpandableId = useMemo(() => {
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if (g.type === 'read' || g.type === 'edit' || g.type === 'bash') {
        return g.id;
      }
    }
    return null;
  }, [groups]);

  // Find the latest task card
  const latestTaskCardId = useMemo(() => {
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].type === 'tasks') {
        return groups[i].id;
      }
    }
    return null;
  }, [groups]);

  // Early return if messages are not loaded yet (after all hooks)
  if (!messages) {
    return (
      <div className="w-full h-full bg-background rounded-lg flex flex-col border relative" />
    );
  }


  return (
    <div className="w-full h-full bg-background rounded-lg flex flex-col border relative overflow-hidden">
      {/* Top fade */}
      <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-background to-transparent z-10 rounded-t-lg pointer-events-none" />
      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 px-2 overflow-hidden">
        <div className="flex flex-col gap-y-2 p-1 pb-4 pt-4 w-full overflow-hidden" style={{ contain: 'inline-size' }}>
          {groups.length === 0 && (
            <Message
              message={
                {
                  role: "assistant",
                  content: "Hello, I'm VibraCoder. How can I help you today?",
                } as Doc<"messages">
              }
              showAvatar={true}
            />
          )}
          {groups.map((group, index) => {
              // Determine if this is the latest expandable group
              const isLatestExpandable = group.id === latestExpandableId;
              const isLatestTaskCard = group.id === latestTaskCardId;
              const isLatest = isLatestExpandable || isLatestTaskCard;

              // Show avatar if it's the first message or if the role/type changed
              const prevGroup = groups[index - 1];
              const showAvatar = index === 0 ||
                group.type === 'user' !== (prevGroup?.type === 'user') ||
                (group.type === 'text' && prevGroup?.type !== 'text');

              return (
                <GroupedMessage
                  key={group.id}
                  group={group}
                  isLatest={isLatest}
                  showAvatar={showAvatar}
                />
              );
            })}
          {session.status === "CUSTOM" && (
            <div className="flex items-center gap-x-3 mt-3 pl-10 py-2">
              <div className="size-2.5 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
              <TextShimmer className="text-sm text-muted-foreground">
                {session.statusMessage?.slice(0, 50) || "Working on task"}
              </TextShimmer>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="flex-shrink-0 p-3 bg-background flex flex-col gap-y-2 backdrop-blur-md border-t">
        <ChatForm
          onSubmit={handleSubmit}
          sessionId={session.sessionId}
          isAgentRunning={isAgentRunning}
          isStoppingAgent={isStoppingAgent}
          isSendingMessage={isSendingMessage}
          onStopAgent={handleStopAgent}
          showModelSelector={true}
          externalPromptText={promptText}
          onExternalPromptTextClear={() => setPromptText("")}
          externalImages={externalImages}
          onExternalImagesClear={() => setExternalImages([])}
        />
      </div>
    </div>
  );
}
