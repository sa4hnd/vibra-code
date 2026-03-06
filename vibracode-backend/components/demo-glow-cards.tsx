import PromptGlowCard from "@/components/ui/prompt-glow-card";
import { Film, Package, CheckSquare, FolderOpen, Video, ShoppingBag, Home, Music } from "lucide-react";

export default function DemoGlowCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-8 bg-black min-h-screen">
      <PromptGlowCard
        glowColor="red"
        onClick={() => console.log("Netflix clicked")}
      >
        <div className="flex flex-col items-center text-center h-full justify-center">
          <div className="mb-3 p-3 rounded-full bg-white/10 backdrop-blur-sm">
            <Film className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-sm font-medium text-white group-hover:text-white/90 transition-colors">
            Netflix Clone
          </h3>
        </div>
      </PromptGlowCard>

      <PromptGlowCard
        glowColor="blue"
        onClick={() => console.log("Admin clicked")}
      >
        <div className="flex flex-col items-center text-center h-full justify-center">
          <div className="mb-3 p-3 rounded-full bg-white/10 backdrop-blur-sm">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-sm font-medium text-white group-hover:text-white/90 transition-colors">
            Admin Dashboard
          </h3>
        </div>
      </PromptGlowCard>

      <PromptGlowCard
        glowColor="green"
        onClick={() => console.log("Kanban clicked")}
      >
        <div className="flex flex-col items-center text-center h-full justify-center">
          <div className="mb-3 p-3 rounded-full bg-white/10 backdrop-blur-sm">
            <CheckSquare className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-sm font-medium text-white group-hover:text-white/90 transition-colors">
            Kanban Board
          </h3>
        </div>
      </PromptGlowCard>

      <PromptGlowCard
        glowColor="purple"
        onClick={() => console.log("Spotify clicked")}
      >
        <div className="flex flex-col items-center text-center h-full justify-center">
          <div className="mb-3 p-3 rounded-full bg-white/10 backdrop-blur-sm">
            <Music className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-sm font-medium text-white group-hover:text-white/90 transition-colors">
            Spotify Clone
          </h3>
        </div>
      </PromptGlowCard>
    </div>
  );
}
