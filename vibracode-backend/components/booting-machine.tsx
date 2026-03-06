"use client";

import { useEffect, useState } from "react";
import { Loader, Sparkles, Cpu, Rocket, Zap } from "lucide-react";

// Map status to friendly descriptions and icons
const STATUS_CONFIG: Record<string, { label: string; description: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  "IN PROGRESS": { label: "Initializing", description: "Setting up your environment", icon: Cpu, color: "text-blue-400" },
  "CLONING REPO": { label: "Cloning", description: "Fetching template files", icon: Rocket, color: "text-purple-400" },
  "INSTALLING DEPENDENCIES": { label: "Installing", description: "Adding packages", icon: Zap, color: "text-yellow-400" },
  "STARTING DEV SERVER": { label: "Starting", description: "Launching dev server", icon: Sparkles, color: "text-green-400" },
  "CREATING TUNNEL": { label: "Connecting", description: "Creating secure tunnel", icon: Sparkles, color: "text-cyan-400" },
  "RUNNING": { label: "Running", description: "Your app is ready", icon: Sparkles, color: "text-emerald-400" },
  "BOOTING MACHINE": { label: "Booting", description: "Starting sandbox", icon: Cpu, color: "text-orange-400" },
  "GENERATING PREVIEW": { label: "Rendering", description: "Building preview", icon: Sparkles, color: "text-pink-400" },
};

// Progress steps for visual indicator
const STEPS = [
  "IN PROGRESS",
  "CLONING REPO",
  "INSTALLING DEPENDENCIES",
  "STARTING DEV SERVER",
  "CREATING TUNNEL",
  "RUNNING"
];

export default function BootingMachine({
  label,
  size = "md",
}: {
  label: string;
  size?: "md" | "lg";
}) {
  const [dots, setDots] = useState("");

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const normalizedLabel = label.toUpperCase();
  const config = STATUS_CONFIG[normalizedLabel] || STATUS_CONFIG["BOOTING MACHINE"];
  const IconComponent = config.icon;

  // Calculate progress
  const currentStepIndex = STEPS.indexOf(normalizedLabel);
  const progress = currentStepIndex >= 0 ? ((currentStepIndex + 1) / STEPS.length) * 100 : 15;

  if (size === "lg") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-background via-background to-muted/20 p-8">
        {/* Animated background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 ${config.color.replace('text-', 'bg-')}/10 rounded-full blur-3xl animate-pulse`} />
        </div>

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center gap-6 max-w-xs text-center">
          {/* Icon with glow */}
          <div className="relative">
            <div className={`absolute inset-0 ${config.color.replace('text-', 'bg-')}/30 rounded-full blur-xl animate-pulse`} />
            <div className={`relative size-16 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center ${config.color}`}>
              <IconComponent className="size-8" />
            </div>
          </div>

          {/* Status text */}
          <div className="space-y-2">
            <h3 className={`text-lg font-bold ${config.color}`}>
              {config.label}{dots}
            </h3>
            <p className="text-sm text-muted-foreground">
              {config.description}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-[200px] space-y-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${config.color.replace('text-', 'bg-')}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono">
              <span>SANDBOX</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Vibra branding */}
          <div className="mt-4 flex items-center gap-2 text-muted-foreground/40">
            <div className="size-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-mono tracking-wider">VIBRA CODE</span>
          </div>
        </div>
      </div>
    );
  }

  // Compact version (md size)
  return (
    <div className="w-auto px-4 rounded-full h-12 border border-muted-foreground/30 bg-background/80 backdrop-blur-sm relative overflow-hidden flex items-center justify-center gap-x-3">
      <div className={`relative size-6 rounded-lg bg-muted/50 flex items-center justify-center ${config.color}`}>
        <IconComponent className="size-3.5" />
      </div>
      <div className="flex items-center gap-x-2">
        <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`size-1 rounded-full ${config.color.replace('text-', 'bg-')} transition-opacity duration-300`}
              style={{ opacity: dots.length > i ? 1 : 0.3 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
