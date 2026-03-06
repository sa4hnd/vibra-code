"use client";

import { useState, useRef } from "react";
import { Loader, Video, Download, Trash2, Sparkles, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface VideoStudioTabProps {
  onAddToPrompt?: (text: string) => void;
}

interface GeneratedVideo {
  _id: Id<"generatedVideos">;
  name: string;
  prompt?: string;
  storageId?: Id<"_storage">;
  url?: string;
  status: 'generating' | 'completed' | 'error';
  errorMessage?: string;
  createdAt: number;
}

export default function VideoStudioTab({ onAddToPrompt }: VideoStudioTabProps) {
  const { user } = useUser();
  const [selectedVideoId, setSelectedVideoId] = useState<Id<"generatedVideos"> | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [playingId, setPlayingId] = useState<Id<"generatedVideos"> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // Query videos from Convex
  const videos = useQuery(
    api.videos.getByUser,
    user ? { clerkId: user.id } : "skip"
  ) as GeneratedVideo[] | undefined;

  const startGeneration = useMutation(api.videos.startGeneration);
  const deleteVideoMutation = useMutation(api.videos.deleteVideo);

  const selectedVideo = videos?.find(video => video._id === selectedVideoId);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in to generate videos");
      return;
    }

    if (!prompt.trim()) return;

    const videoName = `video-${videos?.length || 0 + 1}`;

    setIsGenerating(true);
    const currentPrompt = prompt.trim();
    setPrompt('');

    try {
      // Step 1: Create placeholder in Convex
      console.log("Creating placeholder in Convex...");
      const videoId = await startGeneration({
        clerkId: user.id,
        name: videoName,
        prompt: currentPrompt,
      });

      console.log(`Placeholder created with ID: ${videoId}`);

      // Step 2: Trigger Inngest function via API route
      console.log("Triggering Inngest video generation...");
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videoId,
          prompt: currentPrompt,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start video generation');
      }

      console.log("Inngest job queued successfully");
      toast.success("Video generation started! This may take up to 5 minutes.");
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate video');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = (video: GeneratedVideo) => {
    if (playingId === video._id) {
      videoRef.current?.pause();
      setPlayingId(null);
    } else {
      if (videoRef.current && video.url) {
        videoRef.current.src = video.url;
        videoRef.current.play();
        setPlayingId(video._id);
      }
    }
  };

  const handleDownload = async (video: GeneratedVideo) => {
    if (!video.url) return;

    try {
      const response = await fetch(video.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${video.name}-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Video downloaded");
    } catch (error) {
      toast.error("Failed to download video");
    }
  };

  const handleDelete = async (videoId: Id<"generatedVideos">) => {
    try {
      await deleteVideoMutation({ id: videoId });
      if (selectedVideoId === videoId) {
        setSelectedVideoId(null);
      }
      if (playingId === videoId) {
        videoRef.current?.pause();
        setPlayingId(null);
      }
      toast.success("Video deleted");
    } catch (error) {
      toast.error("Failed to delete video");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <video ref={videoRef} onEnded={() => setPlayingId(null)} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-blue-400" />
          <span className="text-xs text-muted-foreground">
            {videos?.filter(v => v.status === 'completed').length || 0} videos
          </span>
        </div>
      </div>

      {/* Video List */}
      <div className="flex-1 min-h-0 overflow-auto p-3 bg-black/10">
        {!videos || videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Video className="w-12 h-12 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground mb-1">No videos yet</p>
            <p className="text-xs text-muted-foreground/60">Generate videos from text prompts</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {videos.map((video) => (
              <div
                key={video._id}
                className={cn(
                  "relative aspect-video rounded-lg overflow-hidden border cursor-pointer transition-all group",
                  selectedVideoId === video._id
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border/30 hover:border-primary/50"
                )}
                onClick={() => setSelectedVideoId(video._id)}
              >
                {video.status === 'generating' ? (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-cyan-500/10 flex flex-col items-center justify-center relative overflow-hidden">
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <Loader className="h-6 w-6 text-muted-foreground animate-spin mb-2 relative z-10" />
                    <span className="text-xs text-muted-foreground relative z-10">Generating...</span>
                  </div>
                ) : video.status === 'error' ? (
                  <div className="w-full h-full bg-destructive/10 flex flex-col items-center justify-center">
                    <span className="text-xs text-destructive">Failed</span>
                  </div>
                ) : (
                  <>
                    {video.url && (
                      <>
                        {console.log('Video URL:', video.url)}
                        <video
                          src={video.url}
                          className="w-full h-full object-cover"
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          onMouseEnter={(e) => {
                            e.currentTarget.currentTime = 0;
                            e.currentTarget.play();
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                          onError={(e) => {
                            console.error('Video load error:', e);
                            console.error('Failed URL:', video.url);
                          }}
                        />
                      </>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white/90 font-mono truncate">@{video.name}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayPause(video);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all"
                    >
                      {playingId === video._id ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Video Actions */}
      {selectedVideo && selectedVideo.status === 'completed' && (
        <div className="px-3 py-2 border-t bg-background/50 flex-shrink-0">
          <div className="flex gap-2">
            <Button
              onClick={() => handleDownload(selectedVideo)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
            <Button
              onClick={() => handleDelete(selectedVideo._id)}
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Prompt Input */}
      <div className="px-3 py-3 border-t flex-shrink-0">
        <form onSubmit={handleGenerate}>
          <div className="relative">
            <textarea
              ref={promptInputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the video to generate..."
              className="w-full h-20 resize-none text-sm bg-muted/20 border border-border/50 rounded-lg p-3 pr-12 outline-none focus:border-primary/50 transition-colors"
              disabled={isGenerating}
            />
            <Button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              size="sm"
              className="absolute bottom-2 right-2 h-8 w-8 p-0 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
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
