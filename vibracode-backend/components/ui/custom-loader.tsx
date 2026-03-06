import React from 'react';
import { cn } from '@/lib/utils';

interface CustomLoaderProps {
  text?: string;
  className?: string;
}

export function CustomLoader({ text = "Generating", className }: CustomLoaderProps) {
  const letters = text.split('');

  return (
    <div className={cn("flex items-center justify-center h-full w-full", className)}>
      <div className="relative flex items-center justify-center h-32 w-auto mx-8 scale-200 font-poppins text-2xl font-semibold text-white select-none">
        {/* Letters */}
        {letters.map((letter, index) => (
          <span
            key={index}
            className="inline-block opacity-0 z-20"
            style={{
              animation: 'loader-letter-anim 4s infinite linear',
              animationDelay: `${0.1 + index * 0.105}s`
            }}
          >
            {letter}
          </span>
        ))}
        
        {/* Loader background with mask */}
        <div 
          className="absolute inset-0 z-10 bg-transparent"
          style={{
            mask: 'repeating-linear-gradient(90deg, transparent 0, transparent 6px, black 7px, black 8px)'
          }}
        />
        
        {/* Animated colorful background */}
        <div 
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 50% 50%, #ff0 0%, transparent 50%),
              radial-gradient(circle at 45% 45%, #f00 0%, transparent 45%),
              radial-gradient(circle at 55% 55%, #0ff 0%, transparent 45%),
              radial-gradient(circle at 45% 55%, #0f0 0%, transparent 45%),
              radial-gradient(circle at 55% 45%, #00f 0%, transparent 45%)
            `,
            mask: 'radial-gradient(circle at 50% 50%, transparent 0%, transparent 10%, black 25%)',
            animation: 'transform-animation 2s infinite alternate, opacity-animation 4s infinite',
            animationTimingFunction: 'cubic-bezier(0.6, 0.8, 0.5, 1)'
          }}
        />
      </div>

      <style jsx>{`
        @keyframes transform-animation {
          0% {
            transform: translate(-55%);
          }
          100% {
            transform: translate(55%);
          }
        }

        @keyframes opacity-animation {
          0%, 100% {
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          65% {
            opacity: 0;
          }
        }

        @keyframes loader-letter-anim {
          0% {
            opacity: 0;
          }
          5% {
            opacity: 1;
            text-shadow: 0 0 4px #fff;
            transform: scale(1.1) translateY(-2px);
          }
          20% {
            opacity: 0.2;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default CustomLoader;
