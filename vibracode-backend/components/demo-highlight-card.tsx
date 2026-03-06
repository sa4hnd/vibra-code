import ProjectHighlightCard from "@/components/ui/project-highlight-card";
import { Rocket, Code, Smartphone } from "lucide-react";

export default function DemoHighlightCard() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-8">
      <ProjectHighlightCard
        title="Space Explorer"
        templateId="expo"
        createdAt={Date.now() - 1000 * 60 * 30} // 30 minutes ago
        icon={<Rocket className="w-4 h-4 text-white" />}
        onClick={() => console.log("Space Explorer clicked")}
      />
      
      <ProjectHighlightCard
        title="E-commerce Platform"
        templateId="nextjs"
        createdAt={Date.now() - 1000 * 60 * 60 * 2} // 2 hours ago
        icon={<Code className="w-4 h-4 text-white" />}
        onClick={() => console.log("E-commerce clicked")}
      />
      
      <ProjectHighlightCard
        title="Mobile App"
        templateId="expo"
        createdAt={Date.now() - 1000 * 60 * 60 * 24} // 1 day ago
        icon={<Smartphone className="w-4 h-4 text-white" />}
        onClick={() => console.log("Mobile App clicked")}
      />
    </div>
  );
}
