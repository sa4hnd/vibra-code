"use client";

import { ArrowUp, Loader, Lock, Square } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useUsage } from "@/lib/hooks/use-usage";
import { useUser } from "@clerk/nextjs";
import { Repo } from "@/app/actions/github";

import { Button } from "@/components/ui/button";
import { ImageUpload, ImageUploadForm } from "./image-upload";
import { TemplateSelector } from "./template-selector";
import { RepositorySelector } from "./repository-selector";
import { MessageWarning } from "./message-warning";
import { ModelSelector, ClaudeModel } from "./model-selector";

type FormData = {
  message: string;
  repository?: string;
  template?: string;
};

interface ChatFormProps {
  onSubmit: (message: string, repository?: Repo, imageData?: {fileName: string, path: string, storageId: string} | null, template?: string, model?: ClaudeModel) => void | Promise<void>;
  showRepositories?: boolean;
  showTemplates?: boolean;
  showModelSelector?: boolean;
  sessionId?: string;
  onPromptSelect?: (prompt: string) => void;
  inputHeight?: 'small' | 'large';
  isAgentRunning?: boolean;
  isStoppingAgent?: boolean;
  isSendingMessage?: boolean;
  onStopAgent?: () => void;
  externalPromptText?: string;
  onExternalPromptTextClear?: () => void;
  externalImages?: File[];
  onExternalImagesClear?: () => void;
}

export default function ChatForm({
  onSubmit,
  showRepositories = false,
  showTemplates = false,
  showModelSelector = false,
  sessionId,
  onPromptSelect,
  inputHeight = 'small',
  isAgentRunning = false,
  isStoppingAgent = false,
  isSendingMessage = false,
  onStopAgent,
  externalPromptText,
  onExternalPromptTextClear,
  externalImages,
  onExternalImagesClear,
}: ChatFormProps) {
  const { user } = useUser();
  const { canSendMessage, remainingMessages, totalMessages, isPro } = useUsage();
  const [selectedRepo, setSelectedRepo] = useState<Repo | undefined>();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("expo");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ClaudeModel>("claude-opus-4-5-20251101");

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

  // Handle external prompt text (from sidebar "Add to prompt" buttons)
  useEffect(() => {
    if (externalPromptText) {
      const currentMessage = watch("message") || "";
      setValue("message", currentMessage + externalPromptText);
      onExternalPromptTextClear?.();
      // Focus the textarea
      textareaRef.current?.focus();
    }
  }, [externalPromptText, setValue, watch, onExternalPromptTextClear]);

  // Handle external images (from sidebar "Add to chat" buttons)
  useEffect(() => {
    if (externalImages && externalImages.length > 0) {
      setSelectedImages(prev => [...prev, ...externalImages]);
      onExternalImagesClear?.();
      // Focus the textarea
      textareaRef.current?.focus();
    }
  }, [externalImages, onExternalImagesClear]);

  const messageValue = watch("message");
  const isMessageEmpty = !messageValue || messageValue.trim().length === 0;
  const { isSubmitting } = formState;
  const isFormSubmitting = isSubmitting || isLoading || isSendingMessage;

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
        await onSubmit(message, selectedRepo, imageData, undefined, selectedModel);
      } else {
        await onSubmit(message, selectedRepo, imageData, selectedTemplate, selectedModel);
      }
      setSelectedRepo(undefined);
      setSelectedTemplate("expo");
      reset();

      // Reset textarea height to initial value after submitting
      if (textareaRef.current) {
        textareaRef.current.style.height = inputHeight === 'large' ? '48px' : '32px';
      }
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
    <div className="flex flex-col gap-y-3">
      {user && !canSendMessage && (
        <MessageWarning remainingMessages={remainingMessages} totalMessages={totalMessages} isPro={isPro} />
      )}

      <ImageUploadForm
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        onSubmit={handleSubmit(handleFormSubmit)}
        isDragOver={isDragOver}
        disabled={isFormSubmitting}
      >
        <textarea
          {...registerProps}
          ref={(e) => {
            ref(e);
            textareaRef.current = e;
          }}
          className={`w-full resize-none focus:outline-none text-sm overflow-y-auto text-foreground placeholder:text-muted-foreground/60 bg-transparent leading-relaxed ${
            inputHeight === 'large' ? 'min-h-12 max-h-30' : 'min-h-8 max-h-20'
          }`}
          style={{ height: inputHeight === 'large' ? '48px' : '32px' }}
          placeholder="Describe what you want to build..."
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          disabled={isFormSubmitting}
        />

        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="flex items-center gap-2">
            <ImageUpload
              sessionId={sessionId}
              onImagesChange={setSelectedImages}
              disabled={isFormSubmitting}
              images={selectedImages}
            />

            {showModelSelector && (
              <ModelSelector
                value={selectedModel}
                onChange={setSelectedModel}
                disabled={isFormSubmitting}
              />
            )}

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
            className={`ml-auto size-9 rounded-full transition-all duration-200 ${
              isAgentRunning
                ? "bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20"
                : !canSendMessage
                  ? "bg-muted hover:bg-muted text-muted-foreground border border-border/50"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            }`}
            type={isAgentRunning ? "button" : "submit"}
            onClick={isAgentRunning ? onStopAgent : undefined}
            disabled={isAgentRunning ? isStoppingAgent : (isMessageEmpty || isFormSubmitting || !canSendMessage)}
            title={isAgentRunning ? "Stop agent" : (!canSendMessage ? "Insufficient credits" : "Send message")}
          >
            {isStoppingAgent ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : isAgentRunning ? (
              <Square className="h-3 w-3 fill-current" />
            ) : isFormSubmitting ? (
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
