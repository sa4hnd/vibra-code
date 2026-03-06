"use client";
import { useCopyToClipboard } from "usehooks-ts";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Copy, Trash2, Check, Terminal, Search, ListTodo, Image, FileSearch, Code, ChevronDown } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";

import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Markdown } from "../markdown";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@radix-ui/react-avatar";

// Get relative path from vibe0 (shows app/index.ts instead of just index.ts)
const getRelativePath = (path: string) => {
  // Remove /vibe0/ prefix if present, keep the rest
  const cleanPath = path.replace(/^\/vibe0\//, '');
  return cleanPath;
};

// Type for individual tool call details
export type ToolCallDetail = {
  toolName: string;
  input?: any;
  output?: any;
  status?: string;
};

// Type definitions for grouped items (like NewOnboardingScreen15)
export type GroupedItem =
  | { type: 'read'; files: string[]; id: string }
  | { type: 'edit'; files: string[]; id: string }
  | { type: 'bash'; commands: string[]; id: string }
  | { type: 'tool'; toolName: string; count: number; id: string; calls: ToolCallDetail[] }
  | { type: 'tasks'; todos: { id: string; content: string; status: string; priority: string }[]; id: string }
  | { type: 'text'; content: string; id: string }
  | { type: 'user'; content: string; id: string; image?: any };

// Process messages into consecutive groups (like NewOnboardingScreen15)
export function processMessagesIntoGroups(messages: Doc<"messages">[]): GroupedItem[] {
  const groups: GroupedItem[] = [];

  for (const message of messages) {
    const lastGroup = groups[groups.length - 1];

    // User messages don't get grouped
    if (message.role === 'user') {
      groups.push({ type: 'user', content: message.content, id: message._id, image: message.image });
      continue;
    }

    if (message.read) {
      if (lastGroup?.type === 'read') {
        lastGroup.files.push(message.read.filePath);
      } else {
        groups.push({ type: 'read', files: [message.read.filePath], id: message._id });
      }
      continue;
    }

    if (message.edits) {
      if (lastGroup?.type === 'edit') {
        lastGroup.files.push(message.edits.filePath);
      } else {
        groups.push({ type: 'edit', files: [message.edits.filePath], id: message._id });
      }
      continue;
    }

    if (message.bash) {
      if (lastGroup?.type === 'bash') {
        lastGroup.commands.push(message.bash.command);
      } else {
        groups.push({ type: 'bash', commands: [message.bash.command], id: message._id });
      }
      continue;
    }

    if (message.mcpTool || message.tool) {
      const toolName = message.mcpTool?.toolName || message.tool?.toolName || 'Tool';
      const callDetail: ToolCallDetail = {
        toolName,
        input: message.mcpTool?.input || message.tool?.command,
        output: message.mcpTool?.output || message.tool?.output,
        status: message.mcpTool?.status || message.tool?.status,
      };
      if (lastGroup?.type === 'tool' && lastGroup.toolName === toolName) {
        lastGroup.count += 1;
        lastGroup.calls.push(callDetail);
      } else {
        groups.push({ type: 'tool', toolName, count: 1, id: message._id, calls: [callDetail] });
      }
      continue;
    }

    if (message.todos && message.todos.length > 0) {
      groups.push({ type: 'tasks', todos: message.todos, id: message._id });
      continue;
    }

    // Text content only (no special fields)
    if (message.content && message.role === 'assistant') {
      if (message.content.trim() && !message.read && !message.edits && !message.bash && !message.mcpTool && !message.tool) {
        groups.push({ type: 'text', content: message.content, id: message._id });
      }
      continue;
    }
  }

  return groups;
}

// Command Log Row - Expandable with files list (like NewOnboardingScreen15)
interface CommandLogRowProps {
  label: string;
  items: string[];
  count: number;
  iconColor: string;
  isLatest: boolean;
  itemType?: 'file' | 'command';
}

export function CommandLogRow({ label, items, count, iconColor, isLatest, itemType = 'file' }: CommandLogRowProps) {
  const [isExpanded, setIsExpanded] = useState(isLatest);

  // Auto-expand latest, collapse when no longer latest
  useEffect(() => {
    setIsExpanded(isLatest);
  }, [isLatest]);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const itemLabel = itemType === 'command'
    ? (count === 1 ? 'command' : 'commands')
    : (count === 1 ? 'file' : 'files');

  return (
    <div className="my-1 pl-10">
      <button
        onClick={toggleExpand}
        className="flex items-center gap-2 py-2 px-1 w-full hover:bg-muted/30 rounded-lg transition-colors"
      >
        <span className={cn("text-sm", iconColor)}>✱</span>
        <span className={cn("text-sm font-medium", iconColor)}>{label}</span>
        <span className="text-sm text-muted-foreground">({count} {itemLabel})</span>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground ml-auto transition-transform duration-200",
          isExpanded && "rotate-180"
        )} />
      </button>

      {isExpanded && items.length > 0 && (
        <div className="flex ml-3 mt-1 mb-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {/* L-shape vertical line */}
          <div className="w-px bg-border/50 mr-3" />

          {/* Item list */}
          <div className="flex-1 space-y-1">
            {items.slice(0, 8).map((item, index) => (
              <div
                key={index}
                className="text-xs text-muted-foreground py-1 font-mono truncate animate-in fade-in-0 duration-150"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {itemType === 'command' ? item : getRelativePath(item)}
              </div>
            ))}
            {items.length > 8 && (
              <div className="text-xs text-muted-foreground/60 italic py-1">
                +{items.length - 8} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Task Card Component (like NewOnboardingScreen15)
interface TaskCardProps {
  todos: { id: string; content: string; status: string; priority: string }[];
  isLatest?: boolean;
}

export function TaskCard({ todos, isLatest = false }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const completedCount = todos.filter(
    (todo) =>
      todo.status.toLowerCase() === "completed" ||
      todo.status.toLowerCase() === "done"
  ).length;
  const totalCount = todos.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="my-2 ml-10 rounded-xl border border-border/50 bg-muted/20 backdrop-blur-sm overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border/30 hover:bg-muted/40 transition-colors"
      >
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
          !isExpanded && "-rotate-90"
        )} />
        <ListTodo className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold tracking-wide text-foreground/80">TASKS</span>
        <div className="size-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{completedCount}/{totalCount}</span>
        </div>
      </button>

      {/* Task list */}
      {isExpanded && (
        <div className="px-4 py-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {todos.map((todo) => {
            const isCompleted = todo.status.toLowerCase() === "completed" || todo.status.toLowerCase() === "done";
            const isActive = todo.status.toLowerCase() === "in_progress";

            return (
              <div key={todo.id} className="flex items-center gap-2 py-1.5">
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5 text-muted-foreground/50" />
                ) : isActive ? (
                  <div className="size-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse" />
                ) : (
                  <span className="text-muted-foreground/50 text-sm w-3.5 text-center">•</span>
                )}
                <span className={cn(
                  "text-sm flex-1",
                  isCompleted && "text-muted-foreground/50 line-through",
                  isActive && isLatest && "text-foreground font-medium",
                  !isCompleted && !isActive && "text-muted-foreground"
                )}>
                  {todo.content.length > 50 ? `${todo.content.slice(0, 50)}...` : todo.content}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Tool Row Component - Expandable with call details
interface ToolRowProps {
  toolName: string;
  count: number;
  calls: ToolCallDetail[];
  isLatest: boolean;
}

export function ToolRow({ toolName, count, calls, isLatest }: ToolRowProps) {
  const [isExpanded, setIsExpanded] = useState(isLatest);

  // Auto-expand latest, collapse when no longer latest
  useEffect(() => {
    setIsExpanded(isLatest);
  }, [isLatest]);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const displayName = toolName.replace('mcp__', '').replace(/_/g, ' ');

  // Format a single value for display (handles nested objects)
  const formatSingleValue = (value: any): string => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      if (value.length <= 3) return value.map(v => formatSingleValue(v)).join(', ');
      return `[${value.length} items]`;
    }
    try {
      const str = JSON.stringify(value);
      return str.length > 100 ? str.slice(0, 100) + '...' : str;
    } catch {
      return String(value);
    }
  };

  // Render input object as key-value pairs
  const renderInputFields = (input: any) => {
    if (!input) return null;

    // If it's a string, just show it
    if (typeof input === 'string') {
      return (
        <div className="text-foreground/80 font-mono text-xs">
          {input.slice(0, 200)}{input.length > 200 ? '...' : ''}
        </div>
      );
    }

    // If it's an object, show key-value pairs
    if (typeof input === 'object' && !Array.isArray(input)) {
      const entries = Object.entries(input);
      return (
        <div className="space-y-1">
          {entries.slice(0, 5).map(([key, value]) => (
            <div key={key} className="flex gap-2 text-xs">
              <span className="text-muted-foreground shrink-0">{key}:</span>
              <span className="text-foreground/80 font-mono break-all">
                {formatSingleValue(value)}
              </span>
            </div>
          ))}
          {entries.length > 5 && (
            <div className="text-muted-foreground/60 italic text-xs">
              +{entries.length - 5} more fields
            </div>
          )}
        </div>
      );
    }

    // Fallback for arrays or other types
    return (
      <div className="text-foreground/80 font-mono text-xs">
        {formatSingleValue(input)}
      </div>
    );
  };

  // Render output - can be string or object
  const renderOutput = (output: any) => {
    if (!output) return null;

    // If it's a string, truncate long outputs
    if (typeof output === 'string') {
      const truncated = output.length > 300 ? output.slice(0, 300) + '...' : output;
      return (
        <div className="text-foreground/60 font-mono text-xs whitespace-pre-wrap">
          {truncated}
        </div>
      );
    }

    // If it's an object with a specific result field, show that
    if (typeof output === 'object') {
      // Check for common result patterns
      if (output.result) return renderOutput(output.result);
      if (output.content) return renderOutput(output.content);
      if (output.text) return renderOutput(output.text);
      if (output.data) return renderOutput(output.data);

      // Show object summary
      const keys = Object.keys(output);
      return (
        <div className="text-foreground/60 font-mono text-xs">
          {`{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`}
        </div>
      );
    }

    return <div className="text-foreground/60 font-mono text-xs">{formatSingleValue(output)}</div>;
  };

  return (
    <div className="my-1 pl-10">
      <button
        onClick={toggleExpand}
        className="flex items-center gap-2 py-2 px-1 w-full hover:bg-muted/30 rounded-lg transition-colors"
      >
        <span className="text-sm text-orange-400">✱</span>
        <span className="text-sm font-medium text-orange-400">{displayName}</span>
        <span className="text-sm text-muted-foreground">({count} {count === 1 ? 'call' : 'calls'})</span>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground ml-auto transition-transform duration-200",
          isExpanded && "rotate-180"
        )} />
      </button>

      {isExpanded && calls.length > 0 && (
        <div className="flex ml-3 mt-1 mb-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {/* L-shape vertical line */}
          <div className="w-px bg-border/50 mr-3" />

          {/* Call details list */}
          <div className="flex-1 space-y-2 overflow-hidden">
            {calls.slice(0, 5).map((call, index) => (
              <div
                key={index}
                className="text-xs bg-muted/30 rounded-lg p-3 animate-in fade-in-0 duration-150 space-y-2"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {call.input && (
                  <div>
                    <div className="text-muted-foreground font-medium text-[10px] uppercase tracking-wide mb-1">
                      Input
                    </div>
                    {renderInputFields(call.input)}
                  </div>
                )}
                {call.output && (
                  <div>
                    <div className="text-muted-foreground font-medium text-[10px] uppercase tracking-wide mb-1">
                      Output
                    </div>
                    {renderOutput(call.output)}
                  </div>
                )}
                {!call.input && !call.output && (
                  <span className="text-muted-foreground italic">No details available</span>
                )}
              </div>
            ))}
            {calls.length > 5 && (
              <div className="text-xs text-muted-foreground/60 italic py-1">
                +{calls.length - 5} more calls
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Grouped Message Component - renders a grouped item
interface GroupedMessageProps {
  group: GroupedItem;
  isLatest: boolean;
  showAvatar: boolean;
}

export function GroupedMessage({ group, isLatest, showAvatar }: GroupedMessageProps) {
  const { user } = useUser();
  const params = useParams();
  const sessionId = params.id as string;
  const isValidConvexId = sessionId && /^[a-z0-9]{32}$/.test(sessionId);

  // Requires createdBy for security
  const session = useQuery(
    api.sessions.getById,
    isValidConvexId && user?.id ? { id: sessionId as Id<"sessions">, createdBy: user.id } : "skip"
  );
  const deleteMessage = useMutation(api.messages.remove);
  const [, copy] = useCopyToClipboard();
  const [isCopied, setIsCopied] = useState(false);

  // Get storage URL for user image messages
  const imageData = group.type === 'user' ? group.image : null;
  const storageUrl = useQuery(
    api.messages.getStorageUrl,
    imageData?.storageId ? { storageId: imageData.storageId } : "skip"
  );

  const handleCopy = async (content: string) => {
    const success = await copy(content);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDelete = async (id: string) => {
    if (session) {
      await deleteMessage({
        id: id as Id<"messages">,
        sessionId: session.id as Id<"sessions">,
      });
    }
  };

  // User message
  if (group.type === 'user') {
    return (
      <div className="group relative rounded-xl transition-colors duration-200 hover:bg-muted/30 p-2 w-full overflow-hidden">
        <div className="flex items-start gap-x-3 justify-end w-full">
          <div className="flex flex-col gap-y-2 flex-1 max-w-[85%] overflow-hidden">
            {/* Text content */}
            {group.content && group.content.trim() && (
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 ml-auto shadow-sm max-w-full overflow-hidden">
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {(() => {
                    let displayContent = group.content;
                    displayContent = displayContent.replace(/\[Image: .+? at \/tmp\/.+?\]/g, '');
                    displayContent = displayContent.trim();
                    return displayContent;
                  })()}
                </p>
              </div>
            )}

            {/* Image content */}
            {group.image && (
              <div className="ml-auto mt-1 flex gap-2">
                <div className="rounded-lg overflow-hidden border border-border/50 w-14 h-14 shadow-sm">
                  {group.image?.storageId ? (
                    storageUrl ? (
                      <img
                        src={storageUrl}
                        alt={group.image?.fileName || 'Image'}
                        className="w-14 h-14 object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-muted/50 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">...</span>
                      </div>
                    )
                  ) : (
                    <div className="w-14 h-14 bg-muted/50 flex items-center justify-center">
                      <Image className="size-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {showAvatar ? (
            <div className="size-9 rounded-full border-2 border-blue-500/30 bg-blue-500/10 flex items-center justify-center overflow-hidden flex-shrink-0">
              <Avatar>
                <AvatarImage
                  src={user?.imageUrl || ""}
                  className="rounded-full size-9"
                />
                <AvatarFallback className="bg-blue-500 text-white text-sm font-medium">
                  {user?.firstName?.charAt(0) || user?.emailAddresses[0]?.emailAddress?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <div className="size-9" />
          )}
        </div>
        <div className="absolute border border-border/50 rounded-lg p-1 bg-background/95 backdrop-blur-sm top-2 left-2 flex opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 hover:bg-muted"
            aria-label="Copy message"
            onClick={() => handleCopy(group.content)}
          >
            {isCopied ? (
              <Check className="size-3.5 text-green-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(group.id)}
            className="size-7 hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete message"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // Read files group
  if (group.type === 'read') {
    return (
      <CommandLogRow
        label="Read file"
        items={group.files}
        count={group.files.length}
        iconColor="text-purple-400"
        isLatest={isLatest}
        itemType="file"
      />
    );
  }

  // Edit files group
  if (group.type === 'edit') {
    return (
      <CommandLogRow
        label="Edit file"
        items={group.files}
        count={group.files.length}
        iconColor="text-blue-400"
        isLatest={isLatest}
        itemType="file"
      />
    );
  }

  // Bash commands group
  if (group.type === 'bash') {
    return (
      <CommandLogRow
        label="Ran command"
        items={group.commands}
        count={group.commands.length}
        iconColor="text-green-400"
        isLatest={isLatest}
        itemType="command"
      />
    );
  }

  // Tool calls
  if (group.type === 'tool') {
    return <ToolRow toolName={group.toolName} count={group.count} calls={group.calls} isLatest={isLatest} />;
  }

  // Tasks
  if (group.type === 'tasks') {
    return <TaskCard todos={group.todos} isLatest={isLatest} />;
  }

  // Text content (assistant)
  if (group.type === 'text') {
    return (
      <div className="group relative rounded-xl transition-colors duration-200 hover:bg-muted/30 p-2 overflow-hidden w-full" style={{ contain: 'inline-size' }}>
        <div className="flex items-start gap-x-3 w-full overflow-hidden">
          {showAvatar ? (
            <div className="size-9 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img
                src="/brand-assets/vibra-logo.png"
                alt="VibraCode Assistant"
                className="w-6 h-6 object-contain"
              />
            </div>
          ) : (
            <div className="size-9 flex-shrink-0" />
          )}
          <div className={cn("flex flex-col gap-y-1 flex-1 min-w-0 overflow-hidden prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-pre:overflow-x-auto break-words")} style={{ maxWidth: 'calc(100% - 48px)' }}>
            <Markdown>{group.content}</Markdown>
          </div>
        </div>
        <div className="absolute border border-border/50 rounded-lg p-1 bg-background/95 backdrop-blur-sm top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 hover:bg-muted"
            aria-label="Copy message"
            onClick={() => handleCopy(group.content)}
          >
            {isCopied ? (
              <Check className="size-3.5 text-green-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// Legacy Message component for backwards compatibility
export default function Message({
  message,
  showAvatar = true,
}: {
  message: Doc<"messages">;
  showAvatar?: boolean;
}) {
  const { user } = useUser();
  const params = useParams();
  const sessionId = params.id as string;

  const isValidConvexId = sessionId && /^[a-z0-9]{32}$/.test(sessionId);

  // Requires createdBy for security
  const session = useQuery(
    api.sessions.getById,
    isValidConvexId && user?.id ? { id: sessionId as Id<"sessions">, createdBy: user.id } : "skip"
  );
  const deleteMessage = useMutation(api.messages.remove);
  const [, copy] = useCopyToClipboard();
  const [isCopied, setIsCopied] = useState(false);

  const storageUrl = useQuery(
    api.messages.getStorageUrl,
    message.image?.storageId ? { storageId: message.image.storageId } : "skip"
  );

  const handleCopy = async () => {
    const success = await copy(message.content);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDelete = async () => {
    if (session) {
      await deleteMessage({
        id: message._id as Id<"messages">,
        sessionId: session.id as Id<"sessions">,
      });
    }
  };

  if (message.role === "user") {
    return (
      <div className="group relative rounded-xl transition-colors duration-200 hover:bg-muted/30 p-2 w-full overflow-hidden">
        <div className="flex items-start gap-x-3 justify-end w-full">
          <div className="flex flex-col gap-y-2 flex-1 max-w-[85%] overflow-hidden">
            {message.content && message.content.trim() && (
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 ml-auto shadow-sm max-w-full overflow-hidden">
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {(() => {
                    let displayContent = message.content;
                    displayContent = displayContent.replace(/\[Image: .+? at \/tmp\/.+?\]/g, '');
                    displayContent = displayContent.trim();
                    return displayContent;
                  })()}
                </p>
              </div>
            )}

            {message.image && (
              <div className="ml-auto mt-1 flex gap-2">
                <div className="rounded-lg overflow-hidden border border-border/50 w-14 h-14 shadow-sm">
                  {message.image?.storageId ? (
                    storageUrl ? (
                      <img
                        src={storageUrl}
                        alt={message.image?.fileName || 'Image'}
                        className="w-14 h-14 object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-muted/50 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">...</span>
                      </div>
                    )
                  ) : (
                    <div className="w-14 h-14 bg-muted/50 flex items-center justify-center">
                      <Image className="size-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {showAvatar ? (
            <div className="size-9 rounded-full border-2 border-blue-500/30 bg-blue-500/10 flex items-center justify-center overflow-hidden flex-shrink-0">
              <Avatar>
                <AvatarImage
                  src={user?.imageUrl || ""}
                  className="rounded-full size-9"
                />
                <AvatarFallback className="bg-blue-500 text-white text-sm font-medium">
                  {user?.firstName?.charAt(0) || user?.emailAddresses[0]?.emailAddress?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <div className="size-9" />
          )}
        </div>
        <div className="absolute border border-border/50 rounded-lg p-1 bg-background/95 backdrop-blur-sm top-2 left-2 flex opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 hover:bg-muted"
            aria-label="Copy message"
            onClick={handleCopy}
          >
            {isCopied ? (
              <Check className="size-3.5 text-green-600" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="size-7 hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete message"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // For assistant messages, we skip rendering here since grouping handles them
  // But we keep this for backwards compatibility with non-grouped views
  if (message.edits || message.read || message.bash || message.mcpTool || message.tool || message.todos) {
    return null; // These are handled by grouping
  }

  if ((!message.content || message.content.trim() === "") && !message.image) {
    return null;
  }

  return (
    <div className="group relative rounded-xl transition-colors duration-200 hover:bg-muted/30 p-2 overflow-hidden w-full" style={{ contain: 'inline-size' }}>
      <div className="flex items-start gap-x-3 w-full overflow-hidden">
        {showAvatar ? (
          <div className="size-9 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img
              src="/brand-assets/vibra-logo.png"
              alt="VibraCode Assistant"
              className="w-6 h-6 object-contain"
            />
          </div>
        ) : (
          <div className="size-9 flex-shrink-0" />
        )}
        <div className={cn("flex flex-col gap-y-1 flex-1 min-w-0 overflow-hidden prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-pre:overflow-x-auto break-words")} style={{ maxWidth: 'calc(100% - 48px)' }}>
          <Markdown>{message.content}</Markdown>
        </div>
      </div>
      <div className="absolute border border-border/50 rounded-lg p-1 bg-background/95 backdrop-blur-sm top-2 right-2 flex opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 hover:bg-muted"
          aria-label="Copy message"
          onClick={handleCopy}
        >
          {isCopied ? (
            <Check className="size-3.5 text-green-600" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}
