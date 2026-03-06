"use client";

import PromptGlowCard from "@/components/ui/prompt-glow-card";
import { Film, Package, CheckSquare, FolderOpen, Video, ShoppingBag, Home, Music } from "lucide-react";
import Image from "next/image";

interface QuickPromptsSectionProps {
  onPromptSelect: (prompt: string) => void;
}

export default function QuickPromptsSection({ onPromptSelect }: QuickPromptsSectionProps) {
  const prompts = [
    { 
      label: "Spotify Clone", 
      icon: <Music className="w-4 h-4 text-white" />, 
      glowColor: "green" as const,
      prompt: "Design a Spotify clone with music player, playlists, dark theme, and smooth animations"
    },
    { 
      label: "YouTube Clone", 
      icon: <Video className="w-4 h-4 text-white" />, 
      glowColor: "red" as const,
      prompt: "Create a YouTube clone with video grid, player, comments, and trending section"
    },
    { 
      label: "Netflix Clone", 
      icon: <Film className="w-4 h-4 text-white" />, 
      glowColor: "red" as const,
      prompt: "Build a Netflix clone with movie cards, hero section, and dark UI design"
    },
    { 
      label: "Airbnb Clone", 
      icon: <Home className="w-4 h-4 text-white" />, 
      glowColor: "purple" as const,
      prompt: "Design an Airbnb clone with property listings, search filters, and booking flow"
    },
    { 
      label: "Instagram Clone", 
      icon: <Video className="w-4 h-4 text-white" />, 
      glowColor: "purple" as const,
      prompt: "Create an Instagram clone with feed, stories, and modern social UI"
    },
    { 
      label: "Wordle Clone", 
      icon: <CheckSquare className="w-4 h-4 text-white" />, 
      glowColor: "green" as const,
      prompt: "Build a Wordle clone with word guessing, keyboard, and colorful feedback tiles"
    },
    { 
      label: "Snake Game", 
      icon: <Video className="w-4 h-4 text-white" />, 
      glowColor: "orange" as const,
      prompt: "Create a Snake game with smooth movement, score tracking, and retro pixel art style"
    },
    { 
      label: "TikTok Clone", 
      icon: <Video className="w-4 h-4 text-white" />, 
      glowColor: "red" as const,
      prompt: "Create a TikTok clone with vertical videos, swipe gestures, and mobile-first design"
    },
  ];

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
        <h3 className="text-sm font-medium text-muted-foreground">Quick Prompts</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        {prompts.map((action, index) => (
          <PromptGlowCard
            key={index}
            glowColor={action.glowColor}
            onClick={() => onPromptSelect(action.prompt)}
          >
            <div className="flex flex-col items-center text-center h-full justify-center">
              <div className="mb-2 p-2 rounded-full bg-white/10 backdrop-blur-sm">
                {action.icon}
              </div>
              <h3 className="text-xs sm:text-sm font-medium text-white group-hover:text-white/90 transition-colors leading-tight">
                {action.label}
              </h3>
            </div>
          </PromptGlowCard>
        ))}
      </div>
    </div>
  );
}
