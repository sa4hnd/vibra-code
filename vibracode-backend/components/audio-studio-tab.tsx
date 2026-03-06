"use client";

import { useState, useRef } from "react";
import { Loader, Music, Download, Trash2, Sparkles, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface AudioStudioTabProps {
  onAddToPrompt?: (text: string) => void;
}

interface GeneratedAudio {
  _id: Id<"generatedAudios">;
  name: string;
  text?: string;
  storageId: Id<"_storage">;
  url: string;
  status: 'generating' | 'completed' | 'error';
  errorMessage?: string;
  createdAt: number;
}

export default function AudioStudioTab({ onAddToPrompt }: AudioStudioTabProps) {
  const { user } = useUser();
  const [selectedAudioId, setSelectedAudioId] = useState<Id<"generatedAudios"> | null>(null);
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [playingId, setPlayingId] = useState<Id<"generatedAudios"> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Query audios from Convex
  const audios = useQuery(
    api.audios.getByUser,
    user ? { clerkId: user.id } : "skip"
  ) as GeneratedAudio[] | undefined;

  const createAudio = useMutation(api.audios.create);
  const deleteAudioMutation = useMutation(api.audios.deleteAudio);

  const selectedAudio = audios?.find(audio => audio._id === selectedAudioId);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in to generate audio");
      return;
    }

    if (!text.trim()) return;

    const audioName = `audio-${audios?.length || 0 + 1}`;

    setIsGenerating(true);
    setText('');

    try {
      const response = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          durationSeconds: 5,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate audio');
      }

      const data = await response.json();

      await createAudio({
        clerkId: user.id,
        name: audioName,
        text: text.trim(),
        storageId: data.storageId as Id<"_storage">,
        url: data.audioUrl,
      });

      toast.success("Sound effect generated!");
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate audio');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = (audio: GeneratedAudio) => {
    if (playingId === audio._id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = audio.url;
        audioRef.current.play();
        setPlayingId(audio._id);
      }
    }
  };

  const handleDownload = async (audio: GeneratedAudio) => {
    try {
      const response = await fetch(audio.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${audio.name}-${Date.now()}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Audio downloaded");
    } catch (error) {
      toast.error("Failed to download audio");
    }
  };

  const handleDelete = async (audioId: Id<"generatedAudios">) => {
    try {
      await deleteAudioMutation({ id: audioId });
      if (selectedAudioId === audioId) {
        setSelectedAudioId(null);
      }
      if (playingId === audioId) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
      toast.success("Audio deleted");
    } catch (error) {
      toast.error("Failed to delete audio");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-purple-400" />
          <span className="text-xs text-muted-foreground">
            {audios?.filter(a => a.status === 'completed').length || 0} sound effects
          </span>
        </div>
      </div>

      {/* Audio List */}
      <div className="flex-1 min-h-0 overflow-auto p-3 bg-black/10">
        {!audios || audios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Music className="w-12 h-12 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground mb-1">No sound effects yet</p>
            <p className="text-xs text-muted-foreground/60">Generate sound effects from text descriptions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {audios.map((audio) => (
              <div
                key={audio._id}
                className={cn(
                  "relative rounded-lg border p-3 cursor-pointer transition-all group",
                  selectedAudioId === audio._id
                    ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                    : "border-border/30 hover:border-primary/50 bg-background"
                )}
                onClick={() => setSelectedAudioId(audio._id)}
              >
                {audio.status === 'generating' ? (
                  <div className="flex items-center gap-2">
                    <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Generating...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayPause(audio);
                      }}
                    >
                      {playingId === audio._id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">@{audio.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{audio.text}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Audio Actions */}
      {selectedAudio && selectedAudio.status === 'completed' && (
        <div className="px-3 py-2 border-t bg-background/50 flex-shrink-0">
          <div className="flex gap-2">
            <Button
              onClick={() => handleDownload(selectedAudio)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
            <Button
              onClick={() => handleDelete(selectedAudio._id)}
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Text Input */}
      <div className="px-3 py-3 border-t flex-shrink-0">
        <form onSubmit={handleGenerate}>
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe the sound effect (e.g., dog barking, birds chirping, ocean waves)..."
              className="w-full h-20 resize-none text-sm bg-muted/20 border border-border/50 rounded-lg p-3 pr-12 outline-none focus:border-primary/50 transition-colors"
              disabled={isGenerating}
            />
            <Button
              type="submit"
              disabled={!text.trim() || isGenerating}
              size="sm"
              className="absolute bottom-2 right-2 h-8 w-8 p-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isGenerating ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
