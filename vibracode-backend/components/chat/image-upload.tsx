"use client";

import { useState, useRef, useEffect } from "react";
import { Image, Loader, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_IMAGES = 7; // Maximum 7 images per message

interface ImageUploadProps {
  sessionId?: string;
  onImagesChange: (images: File[]) => void;
  disabled?: boolean;
  images?: File[];
}

export function ImageUpload({ sessionId, onImagesChange, disabled, images = [] }: ImageUploadProps) {
  const [selectedImages, setSelectedImages] = useState<File[]>(images);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with external images (from drag-drop in parent)
  useEffect(() => {
    if (images.length !== selectedImages.length || images.some((img, i) => img !== selectedImages[i])) {
      setSelectedImages(images);
      // Generate previews for all images
      const newPreviews: string[] = [];
      images.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newPreviews[index] = e.target?.result as string;
          if (newPreviews.filter(Boolean).length === images.length) {
            setImagePreviews([...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });
      if (images.length === 0) {
        setImagePreviews([]);
      }
    }
  }, [images]);

  const handleImageSelect = (files: File[]) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      // Limit to MAX_IMAGES total
      const remainingSlots = MAX_IMAGES - selectedImages.length;
      const filesToAdd = imageFiles.slice(0, remainingSlots);

      if (filesToAdd.length < imageFiles.length) {
        alert(`You can only upload up to ${MAX_IMAGES} images per message. ${imageFiles.length - filesToAdd.length} image(s) were not added.`);
      }

      const newImages = [...selectedImages, ...filesToAdd];
      setSelectedImages(newImages);
      onImagesChange(newImages);

      // Generate previews for new images
      filesToAdd.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreviews(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    onImagesChange(newImages);
  };

  const clearAllImages = () => {
    setSelectedImages([]);
    setImagePreviews([]);
    onImagesChange([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      {/* Image Previews */}
      {imagePreviews.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative inline-block">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="max-w-16 max-h-16 object-cover rounded border"
              />
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute -top-1 -right-1 size-4 bg-red-500/80 hover:bg-red-500 text-white"
                onClick={() => removeImage(index)}
              >
                <X className="h-2 w-2" />
              </Button>
            </div>
          ))}
          {imagePreviews.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs h-8 bg-white/10 hover:bg-white/20 text-white border-white/20"
              onClick={clearAllImages}
            >
              Clear All
            </Button>
          )}
        </div>
      )}

      {/* Image Upload Button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files && handleImageSelect(Array.from(e.target.files))}
        className="hidden"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-8 bg-white/10 hover:bg-white/20 text-white relative"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading || disabled || selectedImages.length >= MAX_IMAGES}
        title={selectedImages.length >= MAX_IMAGES ? `Maximum ${MAX_IMAGES} images reached` : "Upload images (or drag & drop)"}
      >
        {isUploading ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <Image className="h-4 w-4" />
        )}
        {selectedImages.length > 0 && (
          <span className="absolute -top-1 -right-1 size-4 bg-primary text-[10px] rounded-full flex items-center justify-center text-primary-foreground font-bold">
            {selectedImages.length}
          </span>
        )}
      </Button>
    </>
  );
}

export function ImageUploadForm({
  children,
  onDragOver,
  onDragLeave,
  onDrop,
  onPaste,
  onSubmit,
  isDragOver,
  disabled
}: {
  children: React.ReactNode;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onSubmit: (e: React.FormEvent) => void;
  isDragOver: boolean;
  disabled?: boolean;
}) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <form
      className={`relative rounded-2xl border border-white/10 p-3 flex flex-col justify-between bg-gradient-to-br from-[#010101] via-[#090909] to-[#010101] transition-all duration-200 hover:border-white/25 hover:shadow-lg ${
        isDragOver ? 'border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : ''
      }`}
      onSubmit={handleSubmit}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 rounded-2xl bg-primary/10 backdrop-blur-sm z-50 flex flex-col items-center justify-center pointer-events-none border-2 border-dashed border-primary/50">
          <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center mb-3 animate-pulse">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <span className="text-sm font-semibold text-primary">Drop images here</span>
          <span className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF supported</span>
        </div>
      )}
      <div onPaste={onPaste}>
        {children}
      </div>
    </form>
  );
}

