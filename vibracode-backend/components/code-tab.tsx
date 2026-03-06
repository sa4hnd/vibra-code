"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  RefreshCw,
  Plus,
  Code,
  FileText,
  Folder,
  FolderOpen,
  File,
  FileJson,
  FileCode,
  Settings,
  Database,
  Package,
  Globe,
  GitBranch
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Check if file is an image
const isImageFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext);
};

// File icon mapping based on file extension
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'java':
    case 'cpp':
    case 'c':
    case 'go':
    case 'rs':
    case 'swift':
      return Code;
    case 'json':
      return FileJson;
    case 'css':
    case 'scss':
    case 'html':
    case 'xml':
    case 'yaml':
    case 'yml':
      return FileCode;
    case 'md':
    case 'txt':
    case 'log':
      return FileText;
    case 'sql':
      return Database;
    case 'dockerfile':
    case 'docker':
      return Package;
    case 'env':
    case 'ini':
    case 'cfg':
      return Settings;
    default:
      return File;
  }
};

// Get programming language from file extension
const getLanguageFromExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const languageMap: { [key: string]: string } = {
    'js': 'javascript', 'jsx': 'jsx', 'ts': 'typescript', 'tsx': 'tsx',
    'py': 'python', 'java': 'java', 'cpp': 'cpp', 'c': 'c', 'cs': 'csharp',
    'go': 'go', 'rs': 'rust', 'swift': 'swift', 'kt': 'kotlin', 'rb': 'ruby',
    'php': 'php', 'sql': 'sql', 'html': 'html', 'css': 'css', 'scss': 'scss',
    'json': 'json', 'yaml': 'yaml', 'yml': 'yaml', 'md': 'markdown',
    'sh': 'bash', 'bash': 'bash', 'dockerfile': 'dockerfile', 'xml': 'xml'
  };
  return languageMap[ext] || 'text';
};

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: TreeNode[];
  depth: number;
}

interface CodeTabProps {
  session: Doc<"sessions">;
  onAddToPrompt?: (tag: string) => void;
}

export default function CodeTab({ session, onAddToPrompt }: CodeTabProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch directory contents
  const fetchDirectory = useCallback(async (path: string): Promise<FileEntry[]> => {
    if (!session?.sessionId) {
      throw new Error("No sandbox connection available");
    }
    const response = await fetch("/api/filesystem/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, depth: 1, sessionId: session.sessionId }),
    });
    if (!response.ok) throw new Error("Failed to fetch directory");
    const data = await response.json() as { entries: FileEntry[] };
    return data.entries || [];
  }, [session?.sessionId]);

  // Read file content
  const readFile = useCallback(async (path: string): Promise<string> => {
    if (!session?.sessionId) throw new Error("No sandbox connection available");
    const response = await fetch("/api/filesystem/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, format: "text", sessionId: session.sessionId }),
    });
    if (!response.ok) throw new Error("Failed to read file");
    const data = await response.json() as { content: string };
    return data.content || "";
  }, [session?.sessionId]);

  // Load root directory
  const loadRootDirectory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const entries = await fetchDirectory("/vibe0");
      // Filter hidden files but allow .env files
      const shouldShowFile = (name: string) => {
        // Hide .claude folder and CLAUDE.md
        if (name === '.claude' || name === 'CLAUDE.md') return false;
        if (!name.startsWith('.')) return true;
        // Allow .env files
        if (name === '.env' || name.startsWith('.env.')) return true;
        return false;
      };
      const nodes: TreeNode[] = entries
        .filter(entry => shouldShowFile(entry.name))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map(entry => ({
          name: entry.name,
          path: entry.path,
          type: entry.type,
          children: entry.type === "dir" ? [] : undefined,
          depth: 0,
        }));
      setTree(nodes);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setIsLoading(false);
    }
  }, [fetchDirectory]);

  useEffect(() => {
    if (session?.sessionId) {
      loadRootDirectory();
    }
  }, [session?.sessionId, loadRootDirectory]);

  // Toggle folder expansion
  const toggleFolder = async (path: string, depth: number) => {
    const isExpanded = expandedFolders.has(path);
    const newExpanded = new Set(expandedFolders);

    // Filter hidden files but allow .env files
    const shouldShowFile = (name: string) => {
      // Hide .claude folder and CLAUDE.md
      if (name === '.claude' || name === 'CLAUDE.md') return false;
      if (!name.startsWith('.')) return true;
      // Allow .env files
      if (name === '.env' || name.startsWith('.env.')) return true;
      return false;
    };

    if (isExpanded) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
      // Load children if not loaded
      try {
        const entries = await fetchDirectory(path);
        const children: TreeNode[] = entries
          .filter(entry => shouldShowFile(entry.name))
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
            return a.name.localeCompare(b.name);
          })
          .map(entry => ({
            name: entry.name,
            path: entry.path,
            type: entry.type,
            children: entry.type === "dir" ? [] : undefined,
            depth: depth + 1,
          }));

        // Update tree with children
        const updateTree = (nodes: TreeNode[]): TreeNode[] => {
          return nodes.map(node => {
            if (node.path === path) {
              return { ...node, children };
            }
            if (node.children) {
              return { ...node, children: updateTree(node.children) };
            }
            return node;
          });
        };
        setTree(prevTree => updateTree(prevTree));
      } catch (err) {
        console.error("Error loading folder:", err);
      }
    }
    setExpandedFolders(newExpanded);
  };

  // Handle file selection
  const handleFileClick = async (node: TreeNode) => {
    if (node.type !== "file") return;
    setIsLoading(true);
    setError(null);
    try {
      // Determine format based on file type
      const format = isImageFile(node.name) ? "base64" : "text";

      const response = await fetch("/api/filesystem/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: node.path,
          format,
          sessionId: session.sessionId
        }),
      });

      if (!response.ok) throw new Error("Failed to read file");

      const data = await response.json() as { content: string; isBase64?: boolean };
      setSelectedFile(node.path);
      setSelectedFileName(node.name);
      setFileContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setIsLoading(false);
    }
  };

  // Go back to file list
  const handleBack = () => {
    setSelectedFile(null);
    setSelectedFileName("");
    setFileContent("");
    setError(null);
  };

  // Add file to prompt
  const handleAddToPrompt = () => {
    if (selectedFileName) {
      onAddToPrompt?.(`@${selectedFileName} `);
    }
  };

  const getTimeSinceUpdate = () => {
    if (!lastUpdated) return "Not loaded";
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (seconds < 5) return "Updated just now";
    if (seconds < 60) return `Updated ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `Updated ${minutes}m ago`;
  };

  // Render file/folder item
  const renderNode = (node: TreeNode) => {
    const isDirectory = node.type === "dir";
    const isExpanded = expandedFolders.has(node.path);
    const IconComponent = isDirectory ? (isExpanded ? FolderOpen : Folder) : getFileIcon(node.name);
    const iconColor = isDirectory ? "text-yellow-500" : "text-blue-400";

    return (
      <div key={node.path}>
        <button
          onClick={() => isDirectory ? toggleFolder(node.path, node.depth) : handleFileClick(node)}
          className={cn(
            "w-full flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all duration-200",
            "hover:bg-muted/50 text-left",
            selectedFile === node.path && "bg-blue-500/20 border border-blue-500/30"
          )}
          style={{ paddingLeft: `${node.depth * 16 + 12}px` }}
        >
          <IconComponent className={cn("h-4 w-4 flex-shrink-0", iconColor)} />
          <span className="text-sm font-medium truncate">{node.name}</span>
        </button>
        {isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  // File viewer view
  if (selectedFile) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-background/50">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-7 px-2 gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs">Back</span>
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              {(() => {
                const IconComponent = getFileIcon(selectedFileName);
                return <IconComponent className="h-4 w-4 text-blue-400" />;
              })()}
              <span className="text-sm font-medium truncate max-w-[150px]">{selectedFileName}</span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">
            {fileContent.split('\n').length} lines
          </span>
        </div>

        {/* Code Content */}
        <div className="flex-1 min-h-0 overflow-auto bg-[#0d0d0d]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : isImageFile(selectedFileName) ? (
            // Image viewer
            <div className="flex items-center justify-center h-full p-6 bg-muted/10">
              <img
                src={`data:image/${selectedFileName.split('.').pop()};base64,${fileContent}`}
                alt={selectedFileName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg border border-border/30"
                onError={(e) => {
                  // If base64 fails, try treating as text/svg
                  if (selectedFileName.endsWith('.svg')) {
                    e.currentTarget.src = `data:image/svg+xml;utf8,${encodeURIComponent(fileContent)}`;
                  }
                }}
              />
            </div>
          ) : (
            // Code viewer
            <SyntaxHighlighter
              language={getLanguageFromExtension(selectedFileName)}
              style={oneDark}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                fontSize: '11px',
                lineHeight: '1.5',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, monospace',
                background: '#0d0d0d',
                padding: '12px',
                minHeight: '100%',
                width: '100%',
                overflowX: 'auto',
              }}
              showLineNumbers={true}
              wrapLongLines={true}
              lineNumberStyle={{
                color: '#4b5563',
                marginRight: '12px',
                minWidth: '2.5em',
                textAlign: 'right',
                fontSize: '10px',
                userSelect: 'none',
              }}
            >
              {fileContent}
            </SyntaxHighlighter>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t">
          <Button
            onClick={handleAddToPrompt}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add to prompt
          </Button>
        </div>
      </div>
    );
  }

  // File list view
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background/50">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-blue-400" />
          <span className="text-xs text-muted-foreground">{getTimeSinceUpdate()}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadRootDirectory}
          disabled={isLoading}
          className="h-7 w-7 p-0"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* File List */}
      <div className="flex-1 min-h-0 overflow-auto p-2">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={loadRootDirectory}>
              Retry
            </Button>
          </div>
        ) : isLoading && tree.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-4">
            <Folder className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No files yet</p>
            <p className="text-xs text-muted-foreground/70">Start building to see your code</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {tree.map(node => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  );
}
