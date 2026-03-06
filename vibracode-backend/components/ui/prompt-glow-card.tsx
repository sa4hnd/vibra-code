"use client";

import React, { ReactNode } from 'react';

interface PromptGlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: 'blue' | 'purple' | 'green' | 'red' | 'orange';
  onClick?: () => void;
}

const PromptGlowCard: React.FC<PromptGlowCardProps> = ({ 
  children, 
  className = '', 
  glowColor = 'blue',
  onClick
}) => {
  return (
    <div 
      className="group cursor-pointer transform transition-all duration-200 hover:scale-105"
      onClick={onClick}
    >
      <div
        className={`
          bg-gradient-to-br from-[#010101] via-[#090909] to-[#010101] 
          border border-white/10 
          hover:border-white/25 
          transition-all duration-200
          group-hover:shadow-lg
          rounded-2xl
          relative
          w-full
          h-[90px]
          sm:h-[100px]
          p-3
          sm:p-4
          ${className}
        `}
      >
        <div className="relative z-10 flex flex-col h-full">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PromptGlowCard;
