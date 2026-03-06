"use client";

import { useState, useCallback } from "react";
import { Plus, Sparkles, Check, ChevronRight, Cpu, Image as ImageIcon, Database, AudioLines, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface APIModel {
  id: string;
  name: string;
  category: "text" | "image" | "data" | "audio" | "video";
  icon: string;
  tag: string;
  tagColor: "green" | "darkGreen" | "lightGreen";
  description: string;
  cost: string;
}

const API_MODELS: APIModel[] = [
  // Text generation models
  { id: "gpt-mini", name: "GPT-5 Mini", category: "text", icon: "sparkles", tag: "Smart", tagColor: "green", description: "OpenAI GPT-5 Mini is a fast yet advanced AI chatbot. Great for chatting, content generation, and coding.", cost: "0.0020" },
  { id: "gemini-pro", name: "Gemini 3 Pro", category: "text", icon: "star", tag: "Advanced", tagColor: "darkGreen", description: "Google's Gemini 3 Pro with exceptional reasoning, coding, and multimodal understanding.", cost: "0.0050" },
  { id: "grok-fast", name: "Grok 4 Fast", category: "text", icon: "bolt", tag: "Cheap", tagColor: "lightGreen", description: "Grok 4 Fast is optimized for speed and cost efficiency.", cost: "0.0010" },
  { id: "claude-sonnet", name: "Claude Sonnet 4", category: "text", icon: "brain", tag: "Smart", tagColor: "green", description: "Anthropic's Claude Sonnet 4 offers excellent reasoning and safety features.", cost: "0.0030" },
  // Image generation models
  { id: "dalle-4", name: "DALL-E 4", category: "image", icon: "image", tag: "New", tagColor: "green", description: "OpenAI's latest image generation with improved quality and prompt understanding.", cost: "0.0400" },
  { id: "midjourney-v6", name: "Midjourney v6", category: "image", icon: "paintbrush", tag: "Advanced", tagColor: "darkGreen", description: "Midjourney v6 produces stunning artistic images with exceptional detail.", cost: "0.0500" },
  { id: "stable-diffusion-xl", name: "Stable Diffusion XL", category: "image", icon: "sparkles", tag: "Cheap", tagColor: "lightGreen", description: "Open-source image generation with great quality and customization.", cost: "0.0100" },
  { id: "imagen-3", name: "Imagen 3", category: "image", icon: "camera", tag: "Smart", tagColor: "green", description: "Google's Imagen 3 delivers high-quality photorealistic images.", cost: "0.0300" },
  // Data models
  { id: "data-analyzer-pro", name: "Data Analyzer Pro", category: "data", icon: "chart", tag: "Advanced", tagColor: "darkGreen", description: "Advanced data analysis and visualization with statistical modeling.", cost: "0.0150" },
  { id: "sql-assistant", name: "SQL Assistant", category: "data", icon: "table", tag: "Smart", tagColor: "green", description: "AI-powered SQL query generator and database optimization.", cost: "0.0080" },
  { id: "csv-processor", name: "CSV Processor", category: "data", icon: "file", tag: "Cheap", tagColor: "lightGreen", description: "Fast CSV data processing and transformation tool.", cost: "0.0020" },
  // Audio models
  { id: "whisper-large", name: "Whisper Large", category: "audio", icon: "waveform", tag: "Advanced", tagColor: "darkGreen", description: "OpenAI's Whisper Large for high-accuracy speech-to-text.", cost: "0.0060" },
  { id: "tts-premium", name: "TTS Premium", category: "audio", icon: "speaker", tag: "Smart", tagColor: "green", description: "Natural-sounding text-to-speech with multiple voices.", cost: "0.0040" },
  { id: "audio-summarizer", name: "Audio Summarizer", category: "audio", icon: "list", tag: "Cheap", tagColor: "lightGreen", description: "Automatically summarize long audio files and podcasts.", cost: "0.0030" },
  // Video models
  { id: "runway-gen3", name: "Runway Gen-3", category: "video", icon: "video", tag: "New", tagColor: "green", description: "State-of-the-art video generation from text prompts.", cost: "0.1000" },
  { id: "pika-1.5", name: "Pika 1.5", category: "video", icon: "play", tag: "Advanced", tagColor: "darkGreen", description: "Advanced video generation with precise motion control.", cost: "0.0800" },
  { id: "video-editor-ai", name: "Video Editor AI", category: "video", icon: "scissors", tag: "Smart", tagColor: "green", description: "AI-powered video editing and enhancement.", cost: "0.0500" },
];

const CATEGORIES = [
  { id: "text", label: "Text", icon: Cpu },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "data", label: "Data", icon: Database },
  { id: "audio", label: "Audio", icon: AudioLines },
  { id: "video", label: "Video", icon: Video },
] as const;

interface APITabProps {
  onAddToPrompt?: (tag: string) => void;
}

export default function APITab({ onAddToPrompt }: APITabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("text");
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [expandedModel, setExpandedModel] = useState<string | null>(null);

  const filteredModels = API_MODELS.filter(model => model.category === selectedCategory);

  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => {
      const newSet = new Set(prev);
      if (newSet.has(modelId)) {
        newSet.delete(modelId);
      } else {
        newSet.add(modelId);
      }
      return newSet;
    });
  };

  const handleAddToPrompt = () => {
    if (selectedModels.size === 0) return;

    const tags = Array.from(selectedModels).map(id => `@${id}`).join(" ");
    onAddToPrompt?.(tags + " ");

    setSelectedModels(new Set());
  };

  const getTagColorClass = (tagColor: string) => {
    switch (tagColor) {
      case "green": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "darkGreen": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "lightGreen": return "bg-lime-500/20 text-lime-400 border-lime-500/30";
      default: return "bg-green-500/20 text-green-400 border-green-500/30";
    }
  };

  // Detail view for expanded model
  if (expandedModel) {
    const model = API_MODELS.find(m => m.id === expandedModel);
    if (!model) return null;

    return (
      <div className="flex flex-col h-full">
        {/* Back header */}
        <div className="flex items-center gap-2 p-3 border-b bg-background/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpandedModel(null)}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
            Back
          </Button>
          <span className="text-sm font-medium text-muted-foreground">Details</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Model header */}
            <div className="flex items-start gap-4">
              <div className="size-16 rounded-2xl bg-white flex items-center justify-center shadow-lg">
                <Sparkles className="size-8 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-foreground">{model.name}</h3>
                <span className={cn(
                  "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border mt-2",
                  getTagColorClass(model.tagColor)
                )}>
                  {model.tag}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {model.description}
              </p>
            </div>

            {/* Cost */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Average cost per request:</span>
              <span className="font-semibold text-foreground">${model.cost}</span>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Category tabs */}
      <div className="p-2 border-b bg-background/50">
        <div className="flex gap-1 p-1 bg-muted/30 rounded-lg">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-background/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-pink-500" />
          <span className="text-xs text-muted-foreground">
            {selectedModels.size > 0 ? `${selectedModels.size} selected` : "Select API models"}
          </span>
        </div>
      </div>

      {/* Models list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {filteredModels.map(model => {
            const isSelected = selectedModels.has(model.id);
            return (
              <div
                key={model.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl transition-all duration-200",
                  isSelected
                    ? "bg-pink-500/20 border border-pink-500/40"
                    : "hover:bg-muted/50"
                )}
              >
                <button
                  onClick={() => toggleModel(model.id)}
                  className="flex-1 flex items-center gap-3 text-left"
                >
                  {/* Checkbox */}
                  <div className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                    isSelected
                      ? "bg-pink-500 border-pink-500"
                      : "border-muted-foreground/30"
                  )}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>

                  {/* Icon */}
                  <div className="size-10 rounded-xl bg-white flex items-center justify-center shadow-md">
                    <Sparkles className="size-5 text-black" />
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-semibold",
                        isSelected ? "text-pink-400" : "text-foreground"
                      )}>
                        {model.name}
                      </span>
                      <span className={cn(
                        "px-1.5 py-0.5 text-[10px] font-medium rounded border",
                        getTagColorClass(model.tagColor)
                      )}>
                        {model.tag}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      ${model.cost}/request
                    </span>
                  </div>
                </button>

                {/* Chevron for details */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedModel(model.id);
                  }}
                  className="p-2 rounded-full hover:bg-muted/50 transition-colors"
                >
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t">
        <Button
          onClick={handleAddToPrompt}
          disabled={selectedModels.size === 0}
          className={cn(
            "w-full text-white transition-all",
            selectedModels.size > 0
              ? "bg-pink-600 hover:bg-pink-700"
              : "bg-muted text-muted-foreground"
          )}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add to prompt
        </Button>
      </div>
    </div>
  );
}
