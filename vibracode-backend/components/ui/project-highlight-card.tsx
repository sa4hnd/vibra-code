"use client";

import { FC, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";
import Image from "next/image";

interface ProjectHighlightCardProps {
  title: string;
  templateId?: string;
  createdAt: number;
  icon?: ReactNode;
  onClick: () => void;
}

const ProjectHighlightCard: FC<ProjectHighlightCardProps> = ({ 
  title, 
  templateId, 
  createdAt, 
  icon, 
  onClick 
}) => {
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getTemplateIcon = (templateId?: string) => {
    switch (templateId) {
      case "expo":
        return <Image src="/expo.svg" alt="Expo" width={16} height={16} className="w-4 h-4" />;
      case "nextjs":
        return <Image src="/nextjs.svg" alt="Next.js" width={16} height={16} className="w-4 h-4" />;
      case "nextjs-supabase-auth":
        return <Image src="/supabase.jpeg" alt="Supabase" width={16} height={16} className="w-4 h-4 rounded" />;
      case "nextjs-convex-clerk":
        return <Image src="/convex.webp" alt="Convex" width={16} height={16} className="w-4 h-4 rounded" />;
      case "shopify-hydrogen":
        return <Image src="/shopify.jpeg" alt="Shopify" width={16} height={16} className="w-4 h-4 rounded" />;
      case "fastapi-nextjs":
        return <Image src="/fastapi.jpg" alt="FastAPI" width={16} height={16} className="w-4 h-4 rounded" />;
      default:
        return <div className="w-4 h-4 bg-white/20 rounded flex items-center justify-center text-xs">💻</div>;
    }
  };

  return (
    <div 
      className="group cursor-pointer transform transition-all duration-200 hover:scale-105"
      onClick={onClick}
    >
      <Card className="text-white rounded-xl border border-white/10 bg-gradient-to-br from-[#010101] via-[#090909] to-[#010101] shadow-lg relative overflow-hidden hover:border-white/25 hover:shadow-xl w-full h-[100px] sm:h-[120px]">
        
        {/* Background Effects - Simplified */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-white/10 opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 relative z-10 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs backdrop-blur-sm">
                {icon || getTemplateIcon(templateId)}
              </div>
              <span className="text-[10px] font-medium text-white/70 uppercase tracking-wide">
                {templateId || "Custom"}
              </span>
            </div>
          </div>
          
          {/* Title */}
          <div className="flex-1 flex items-center">
            <h3 className="font-medium text-sm leading-tight line-clamp-2 text-white group-hover:text-white/90 transition-colors">
              {title}
            </h3>
          </div>
          
          {/* Footer */}
          <div className="flex items-center mt-2">
            <div className="flex items-center gap-1 text-[10px] text-white/60">
              <Clock className="w-3 h-3" />
              <span>{formatTimeAgo(createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Corner Effects */}
        <div className="absolute top-0 left-0 w-8 h-8 bg-gradient-to-br from-white/10 to-transparent rounded-br-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 bg-gradient-to-tl from-white/10 to-transparent rounded-tl-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </Card>
    </div>
  );
};

export default ProjectHighlightCard;
