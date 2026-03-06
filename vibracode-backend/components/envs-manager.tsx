'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit2, Check, X, RefreshCw, Settings, FileUp } from 'lucide-react';
import { Doc } from '@/convex/_generated/dataModel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from '@/lib/utils';

interface EnvsManagerProps {
  session?: Doc<"sessions">;
}

interface EnvVariable {
  key: string;
  value: string;
}

export function EnvsManager({ session }: EnvsManagerProps) {
  const [envs, setEnvs] = useState<EnvVariable[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');

  // Initialize envs from session data
  useEffect(() => {
    if (session?.envs) {
      const envArray = Object.entries(session.envs).map(([key, value]) => ({
        key,
        value,
      }));
      setEnvs(envArray);
    } else {
      setEnvs([]);
    }
  }, [session?.envs]);

  const handleAddEnv = async () => {
    if (!newKey.trim() || !newValue.trim() || !session?.sessionId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/session/add-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          key: newKey.trim(),
          value: newValue.trim(),
        }),
      });

      if (response.ok) {
        setEnvs(prev => [...prev, { key: newKey.trim(), value: newValue.trim() }]);
        setNewKey('');
        setNewValue('');
        setIsAdding(false);
        await syncToSandbox();
      }
    } catch (error) {
      console.error('Error adding environment variable:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEnv = async (oldKey: string) => {
    if (!session?.sessionId || !editKey.trim() || !editValue.trim()) return;

    setIsLoading(true);
    try {
      if (oldKey !== editKey) {
        await fetch('/api/session/remove-env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.sessionId, key: oldKey }),
        });
      }

      const response = await fetch('/api/session/add-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          key: editKey.trim(),
          value: editValue.trim(),
        }),
      });

      if (response.ok) {
        setEnvs(prev => {
          const filtered = prev.filter(env => env.key !== oldKey);
          return [...filtered, { key: editKey.trim(), value: editValue.trim() }];
        });
        setEditingKey(null);
        await syncToSandbox();
      }
    } catch (error) {
      console.error('Error updating environment variable:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEnv = async (key: string) => {
    if (!session?.sessionId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/session/remove-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, key }),
      });

      if (response.ok) {
        setEnvs(prev => prev.filter(env => env.key !== key));
        await syncToSandbox();
      }
    } catch (error) {
      console.error('Error deleting environment variable:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncToSandbox = async () => {
    if (!session?.sessionId) return;
    try {
      await fetch('/api/session/sync-envs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
    } catch (error) {
      console.error('Error syncing environment variables:', error);
    }
  };

  const handleSyncEnvs = async () => {
    if (!session?.sessionId) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/session/sync-envs-bidirectional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.envs) {
          const envArray = Object.entries(result.envs).map(([key, value]) => ({
            key,
            value: value as string,
          }));
          setEnvs(envArray);
        }
      }
    } catch (error) {
      console.error('Error syncing environment variables:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!session?.sessionId || !bulkImportText.trim()) return;

    setIsLoading(true);
    try {
      // Parse the bulk import text
      const lines = bulkImportText.split('\n').filter(line => line.trim());
      const parsedEnvs: EnvVariable[] = [];

      for (const line of lines) {
        // Skip comments
        if (line.trim().startsWith('#')) continue;

        // Find the first = sign (key can't have =, but value can)
        const equalsIndex = line.indexOf('=');
        if (equalsIndex === -1) continue;

        const key = line.substring(0, equalsIndex).trim();
        let value = line.substring(equalsIndex + 1).trim();

        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (key) {
          parsedEnvs.push({ key, value });
        }
      }

      // Add each parsed env
      for (const env of parsedEnvs) {
        await fetch('/api/session/add-env', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.sessionId,
            key: env.key,
            value: env.value,
          }),
        });
      }

      // Update local state
      setEnvs(prev => {
        const existingKeys = new Set(prev.map(e => e.key));
        const newEnvs = [...prev];
        for (const env of parsedEnvs) {
          if (existingKeys.has(env.key)) {
            const index = newEnvs.findIndex(e => e.key === env.key);
            if (index !== -1) newEnvs[index] = env;
          } else {
            newEnvs.push(env);
          }
        }
        return newEnvs;
      });

      await syncToSandbox();
      setShowBulkImport(false);
      setBulkImportText('');
    } catch (error) {
      console.error('Error bulk importing environment variables:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (env: EnvVariable) => {
    setEditingKey(env.key);
    setEditKey(env.key);
    setEditValue(env.value);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header - matching Expo logs style */}
      <div className="flex items-center justify-between p-3 border-b bg-background/50">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-muted-foreground">
            {envs.length} variable{envs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBulkImport(true)}
            className="h-7 w-7 p-0"
            title="Bulk Import"
          >
            <FileUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSyncEnvs}
            disabled={isLoading}
            className="h-7 w-7 p-0"
            title="Sync"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Variables list */}
      <div className="flex-1 min-h-0 overflow-auto p-2">
        {envs.length === 0 && !isAdding ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center p-4">
            <Settings className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No variables set</p>
            <p className="text-xs text-muted-foreground/70">Add environment variables for your app</p>
          </div>
        ) : (
          <div className="space-y-1">
            {envs.map((env) => (
              <div
                key={env.key}
                className={cn(
                  "rounded-xl p-3 transition-all duration-200",
                  editingKey === env.key
                    ? "bg-gray-500/20 border border-gray-500/40"
                    : "hover:bg-muted/50"
                )}
              >
                {editingKey === env.key ? (
                  <div className="space-y-2">
                    <Input
                      value={editKey}
                      onChange={(e) => setEditKey(e.target.value)}
                      placeholder="Key"
                      className="h-8 text-sm font-mono"
                      disabled={isLoading}
                    />
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Value"
                      className="h-8 text-sm font-mono"
                      disabled={isLoading}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateEnv(env.key)}
                        disabled={!editKey.trim() || !editValue.trim() || isLoading}
                        className="h-7"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingKey(null)}
                        disabled={isLoading}
                        className="h-7"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-300 font-mono truncate">{env.key}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">{env.value}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEditing(env)}
                        disabled={isLoading}
                        className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteEnv(env.key)}
                        disabled={isLoading}
                        className="p-1.5 rounded-md hover:bg-red-500/20 transition-colors text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add new form inline */}
            {isAdding && (
              <div className="rounded-xl p-3 bg-gray-500/20 border border-gray-500/40 space-y-2">
                <Input
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  placeholder="KEY_NAME"
                  className="h-8 text-sm font-mono"
                  disabled={isLoading}
                  autoFocus
                />
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder="value"
                  className="h-8 text-sm font-mono"
                  disabled={isLoading}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleAddEnv}
                    disabled={!newKey.trim() || !newValue.trim() || isLoading}
                    className="h-7"
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsAdding(false);
                      setNewKey('');
                      setNewValue('');
                    }}
                    disabled={isLoading}
                    className="h-7"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t">
        <Button
          onClick={() => setIsAdding(true)}
          disabled={isAdding || isLoading}
          className="w-full bg-gray-600 hover:bg-gray-700 text-white"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Variable
        </Button>
      </div>

      {/* Bulk Import Dialog */}
      <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-gray-400" />
              Bulk Import
            </DialogTitle>
            <DialogDescription>
              Paste your .env file content below. Each line should be KEY=value format.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={bulkImportText}
              onChange={(e) => setBulkImportText(e.target.value)}
              placeholder={`# Paste your .env content here\nDATABASE_URL=postgresql://...\nAPI_KEY=sk-...\nSECRET="my secret value"`}
              className="min-h-[200px] font-mono text-sm"
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Supported formats:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>KEY=value</li>
                <li>KEY="value with spaces"</li>
                <li>KEY='value with spaces'</li>
                <li># Comments are ignored</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkImport(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkImport}
              disabled={!bulkImportText.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
