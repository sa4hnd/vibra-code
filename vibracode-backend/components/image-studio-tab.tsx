"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader, Upload, X, ImageIcon, Download, Trash2, Sparkles, Send, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface ImageStudioTabProps {
  onAddToPrompt?: (text: string) => void;
  onAddToChat?: (file: File) => void;
}

interface GeneratedImage {
  _id: Id<"generatedImages">;
  name: string;
  prompt?: string;
  revisedPrompt?: string;
  storageId?: Id<"_storage">;
  url?: string;
  isUploaded?: boolean;
  status: 'generating' | 'completed' | 'error';
  errorMessage?: string;
  createdAt: number;
}

interface ImageReference {
  id: Id<"generatedImages">;
  name: string;
}

export default function ImageStudioTab({ onAddToPrompt, onAddToChat }: ImageStudioTabProps) {
  const { user } = useUser();
  const [selectedImageId, setSelectedImageId] = useState<Id<"generatedImages"> | null>(null);
  const [prompt, setPrompt] = useState('');
  const [imageReferences, setImageReferences] = useState<ImageReference[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);

  // Query images from Convex
  const images = useQuery(
    api.images.getByUser,
    user ? { clerkId: user.id } : "skip"
  ) as GeneratedImage[] | undefined;

  const createImage = useMutation(api.images.create);
  const startGeneration = useMutation(api.images.startGeneration);
  const deleteImageMutation = useMutation(api.images.deleteImage);

  const selectedImage = images?.find(img => img._id === selectedImageId);

  // Generate unique image name
  const generateImageName = useCallback((isUploaded: boolean) => {
    if (!images) return isUploaded ? 'upload-1' : 'gen-1';
    const prefix = isUploaded ? 'upload' : 'gen';
    const count = images.filter(img => img.isUploaded === isUploaded).length + 1;
    return `${prefix}-${count}`;
  }, [images]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in to generate images");
      return;
    }

    // Get clean prompt (remove @references)
    let cleanPrompt = prompt.trim();
    imageReferences.forEach(ref => {
      cleanPrompt = cleanPrompt.replace(`@${ref.name}`, '').trim();
    });

    if (!cleanPrompt && imageReferences.length === 0) return;

    const imageName = generateImageName(false);

    setIsGenerating(true);
    setPrompt('');
    setImageReferences([]);

    try {
      // Step 1: Create placeholder in Convex
      console.log("Creating placeholder in Convex...");
      const imageId = await startGeneration({
        clerkId: user.id,
        name: imageName,
        prompt: cleanPrompt,
      });

      console.log(`Placeholder created with ID: ${imageId}`);

      // Step 2: Trigger Inngest function via API route
      // Let GPT decide the best size/format/background based on the image content
      console.log("Triggering Inngest image generation...");
      const response = await fetch('/api/generate-image-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: imageId,
          prompt: cleanPrompt,
          referenceImageIds: imageReferences.map(ref => ref.id),
          // Let the AI model decide size, quality, background, and format automatically
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start image generation');
      }

      console.log("Inngest job queued successfully");
      toast.success("Image generation started!");
    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpload = async (files: File[]) => {
    if (!user) {
      toast.error("Please sign in to upload images");
      return;
    }

    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    for (const file of imageFiles) {
      const imageName = generateImageName(true);

      try {
        // Upload to Convex
        const uploadUrlResponse = await fetch('/api/files/generate-upload-url', {
          method: 'POST',
        });
        const { uploadUrl } = await uploadUrlResponse.json();

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }

        const { storageId } = await uploadResponse.json();

        // Get download URL
        const urlResponse = await fetch(`/api/files/get-url?storageId=${storageId}`);
        const { url: fileUrl } = await urlResponse.json();

        // Save to Convex
        await createImage({
          clerkId: user.id,
          name: imageName,
          prompt: `Uploaded: ${file.name}`,
          storageId: storageId as Id<"_storage">,
          url: fileUrl,
          isUploaded: true,
        });

        toast.success(`${file.name} uploaded`);
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUpload(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleAddToChat = async () => {
    if (!selectedImage || selectedImage.status !== 'completed') return;

    try {
      const response = await fetch(selectedImage.url);
      const blob = await response.blob();
      const file = new File([blob], `${selectedImage.name}-${Date.now()}.png`, { type: 'image/png' });
      onAddToChat?.(file);
      toast.success("Added image to chat");
    } catch (error) {
      toast.error("Failed to add image to chat");
    }
  };

  const handleUseAsReference = (image: GeneratedImage) => {
    if (imageReferences.some(ref => ref.id === image._id)) {
      // Remove reference
      setImageReferences(prev => prev.filter(ref => ref.id !== image._id));
      setPrompt(prev => prev.replace(`@${image.name}`, '').replace(/\s+/g, ' ').trim());
    } else {
      // Add reference
      setImageReferences(prev => [...prev, { id: image._id, name: image.name }]);
      setPrompt(prev => {
        const refText = `@${image.name}`;
        if (!prev.includes(refText)) {
          return prev + (prev && !prev.endsWith(' ') ? ' ' : '') + refText + ' ';
        }
        return prev;
      });
    }
    promptInputRef.current?.focus();
  };

  const handleDeleteImage = async (imageId: Id<"generatedImages">) => {
    try {
      await deleteImageMutation({ id: imageId });
      setImageReferences(prev => prev.filter(ref => ref.id !== imageId));
      if (selectedImageId === imageId) {
        setSelectedImageId(null);
      }
      toast.success("Image deleted");
    } catch (error) {
      toast.error("Failed to delete image");
    }
  };

  const handleDownloadImage = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${image.name}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Image downloaded");
    } catch (error) {
      toast.error("Failed to download image");
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-pink-400" />
          <span className="text-xs text-muted-foreground">
            {images?.filter(img => img.status === 'completed').length || 0} images
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInputChange}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 w-7 p-0"
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Image Grid */}
      <div className="flex-1 min-h-0 overflow-auto p-3 bg-black/10">
        {!images || images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground mb-1">No images yet</p>
            <p className="text-xs text-muted-foreground/60">Generate or upload images to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {images.map((image) => (
              <div
                key={image._id}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border cursor-pointer transition-all group",
                  selectedImageId === image._id
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border/30 hover:border-primary/50",
                  imageReferences.some(ref => ref.id === image._id) && "ring-2 ring-orange-500/50 border-orange-500"
                )}
                onClick={() => setSelectedImageId(image._id)}
              >
                {image.status === 'generating' ? (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 flex flex-col items-center justify-center relative overflow-hidden">
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <Loader className="h-6 w-6 text-muted-foreground animate-spin mb-2 relative z-10" />
                    <span className="text-xs text-muted-foreground relative z-10">Generating...</span>
                  </div>
                ) : image.status === 'error' ? (
                  <div className="w-full h-full bg-destructive/10 flex flex-col items-center justify-center">
                    <X className="h-6 w-6 text-destructive mb-1" />
                    <span className="text-xs text-destructive">Failed</span>
                  </div>
                ) : (
                  <>
                    <img
                      src={image.url}
                      alt={image.prompt || image.name}
                      className="w-full h-full object-cover"
                      style={{
                        background: 'repeating-conic-gradient(#1a1a1a 0% 25%, #2a2a2a 0% 50%) 50% / 20px 20px'
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white/90 font-mono">@{image.name}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUseAsReference(image);
                      }}
                      className={cn(
                        "absolute top-2 right-2 p-1.5 rounded-full transition-all",
                        imageReferences.some(ref => ref.id === image._id)
                          ? "bg-orange-500 text-white"
                          : "bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100"
                      )}
                      title={imageReferences.some(ref => ref.id === image._id) ? "Remove as reference" : "Use as reference for editing"}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Image Actions */}
      {selectedImage && selectedImage.status === 'completed' && (
        <div className="px-3 py-2 border-t bg-background/50 flex-shrink-0">
          <div className="flex gap-2">
            <Button
              onClick={() => handleDownloadImage(selectedImage)}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Save
            </Button>
            <Button
              onClick={handleAddToChat}
              size="sm"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Use in Chat
            </Button>
            <Button
              onClick={() => handleDeleteImage(selectedImage._id)}
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
            {/* Background layer */}
            <div className="absolute inset-0 bg-muted/20 border border-border/50 rounded-lg pointer-events-none" />

            {/* Highlighted text overlay */}
            <div
              className="absolute inset-0 p-3 pr-12 text-sm pointer-events-none whitespace-pre-wrap break-words overflow-hidden rounded-lg"
              style={{
                color: 'transparent',
                userSelect: 'none',
              }}
            >
              {prompt.split(/(@[\w-]+)/).map((part, i) => {
                const isReference = imageReferences.some(ref => part === `@${ref.name}`);
                return (
                  <span
                    key={i}
                    className={isReference ? 'bg-orange-500/30 rounded px-0.5' : ''}
                  >
                    {part}
                  </span>
                );
              })}
            </div>

            <textarea
              ref={promptInputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image to generate..."
              className="w-full h-20 resize-none text-sm border-0 rounded-lg p-3 pr-12 outline-none focus:ring-2 focus:ring-primary/50 transition-all relative bg-transparent"
              disabled={isGenerating}
            />
            <Button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              size="sm"
              className="absolute bottom-2 right-2 h-8 w-8 p-0 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
            >
              {isGenerating ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </div>
          {imageReferences.length > 0 && (
            <p className="text-xs text-orange-500 mt-2">
              {imageReferences.length} reference image{imageReferences.length > 1 ? 's' : ''} selected for editing
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
