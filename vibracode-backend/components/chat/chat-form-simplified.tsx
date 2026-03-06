"use client";

import { ArrowUp, Loader, Lock } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useUserCredits } from "@/lib/hooks/use-credits";
import { useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { ImageUpload, ImageUploadForm } from "./image-upload";
import { RepositorySelector } from "./repository-selector";
import { TemplateSelector } from "./template-selector";
import { CreditWarning } from "./credit-warning";

type FormData = {
  message: string;
  repository?: string;
  template?: string;
};

interface ChatFormProps {
  onSubmit: (message: string, repository?: Repo, imageData?: {fileName: string, path: string, storageId: string} | null, template?: string) => void | Promise<void>;
  showRepositories?: boolean;
  showTemplates?: boolean;
  sessionId?: string;
  onPromptSelect?: (prompt: string) => void;
  inputHeight?: 'small' | 'large';
}

export default function ChatForm({
  onSubmit,
  showRepositories = false,
  showTemplates = false,
  sessionId,
  onPromptSelect,
  inputHeight = 'small',
}: ChatFormProps) {
  const { user } = useUser();
  const { canSendMessage, balance } = useUserCredits();
  const [selectedRepo, setSelectedRepo] = useState<Repo | undefined>();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("expo");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, reset, watch, formState, setValue } =
    useForm<FormData>({
      defaultValues: {
        message: "",
        repository: "",
        template: "expo",
      },
    });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle prompt selection from parent
  useEffect(() => {
    if (onPromptSelect) {
      const handlePrompt = (prompt: string) => {
        setValue("message", prompt);
      };
      (window as any).setPrompt = handlePrompt;
    }
  }, [onPromptSelect, setValue]);

  const messageValue = watch("message");
  const isMessageEmpty = !messageValue || messageValue.trim().length === 0;
  const { isSubmitting } = formState;
  const isFormSubmitting = isSubmitting || isLoading;

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const maxHeight = inputHeight === 'large' ? 120 : 80;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isMessageEmpty && !isFormSubmitting) {
        handleSubmit(handleFormSubmit)();
      }
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    setValue("template", templateId);
  };

  const uploadImageToSandbox = async (file: File): Promise<{path: string, storageId: string}> => {
    if (!sessionId) throw new Error('No session ID');
    
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
      headers: {
        'x-session-id': sessionId,
      },
    });
    
    const { path, storageId } = await response.json();
    return { path, storageId };
  };

  const handleFormSubmit = async (data: FormData) => {
    if (!data.message.trim()) return;

    if (!canSendMessage) {
      return;
    }

    setIsLoading(true);
    try {
      let message = data.message.trim();
      let imageData = null;
      
      // If there are images, upload them and include in message
      if (selectedImages.length > 0) {
        try {
          const uploadPromises = selectedImages.map(file => uploadImageToSandbox(file));
          const uploadResults = await Promise.all(uploadPromises);
          
          uploadResults.forEach((result, index) => {
            message = `${message}\n\n[Image: ${selectedImages[index].name} at ${result.path}]`;
          });
          
          if (uploadResults.length > 0) {
            imageData = {
              fileName: selectedImages[0].name,
              path: uploadResults[0].path,
              storageId: uploadResults[0].storageId
            };
          }
        } catch (error) {
          console.error('Failed to upload images:', error);
          message = `${message}\n\n[Image upload failed: ${selectedImages.map(img => img.name).join(', ')}]`;
        }
        
        setSelectedImages([]);
      }
      
      if (sessionId) {
        await onSubmit(message, selectedRepo, imageData);
      } else {
        await onSubmit(message, selectedRepo, imageData, selectedTemplate);
      }
      setSelectedRepo(undefined);
      setSelectedTemplate("expo");
      reset();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      const initialHeight = inputHeight === 'large' ? "48px" : "32px";
      textareaRef.current.style.height = initialHeight;
    }
  }, [inputHeight]);

  const { ref, ...registerProps } = register("message", { required: true });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      setSelectedImages(prev => [...prev, ...imageFiles]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    
    if (imageItems.length > 0) {
      const imageFiles = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[];
      setSelectedImages(prev => [...prev, ...imageFiles]);
    }
  };

  return (
    <div className="flex flex-col gap-y-2">
      {user && !canSendMessage && (
        <CreditWarning balance={balance} />
      )}
      
      <ImageUploadForm
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        isDragOver={isDragOver}
        disabled={isFormSubmitting}
      >
        <textarea
          {...registerProps}
          ref={(e) => {
            ref(e);
            textareaRef.current = e;
          }}
          className={`w-full resize-none focus:outline-none text-sm overflow-hidden text-white placeholder:text-white/60 ${
            inputHeight === 'large' ? 'min-h-12 max-h-30' : 'min-h-8 max-h-20'
          }`}
          style={{ height: inputHeight === 'large' ? '48px' : '32px' }}
          placeholder="Ask VibraCoder to build..."
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isFormSubmitting}
        />
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageUpload
              sessionId={sessionId}
              onImagesChange={setSelectedImages}
              disabled={isFormSubmitting}
            />

            {showTemplates && (
              <TemplateSelector
                selectedTemplate={selectedTemplate}
                onTemplateChange={handleTemplateChange}
                disabled={isFormSubmitting}
              />
            )}

            {showRepositories && (
              <RepositorySelector
                onRepositoryChange={setSelectedRepo}
                disabled={isFormSubmitting}
              />
            )}
          </div>

          <Button
            size="icon"
            className={`ml-auto size-8 ${
              !canSendMessage 
                ? "bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30" 
                : "bg-white/10 hover:bg-white/20 text-white border-white/20"
            }`}
            type="submit"
            disabled={isMessageEmpty || isFormSubmitting || !canSendMessage}
            title={!canSendMessage ? "Insufficient credits" : "Send message"}
          >
            {isFormSubmitting ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : !canSendMessage ? (
              <Lock className="h-4 w-4" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </ImageUploadForm>
    </div>
  );
}
