"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Claude Icon Component
const ClaudeIcon = ({ className }: { className?: string }) => (
  <svg
    height="1em"
    style={{ flex: 'none', lineHeight: 1 }}
    viewBox="0 0 24 24"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <title>Claude</title>
    <path
      d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
      fill="currentColor"
      fillRule="nonzero"
    />
  </svg>
);

export type ClaudeModel =
  | "claude-opus-4-5-20251101"
  | "claude-sonnet-4-5"
  | "claude-haiku-4-5";

interface ModelOption {
  id: ClaudeModel;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const MODELS: ModelOption[] = [
  {
    id: "claude-opus-4-5-20251101",
    name: "Claude Opus 4.5",
    icon: <ClaudeIcon className="h-4 w-4" />,
    description: "Most capable",
  },
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    icon: <ClaudeIcon className="h-4 w-4" />,
    description: "Best balance",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    icon: <ClaudeIcon className="h-4 w-4" />,
    description: "Fastest",
  },
];

interface ModelSelectorProps {
  value?: ClaudeModel;
  onChange?: (model: ClaudeModel) => void;
  disabled?: boolean;
  className?: string;
}

export function ModelSelector({
  value,
  onChange,
  disabled = false,
  className,
}: ModelSelectorProps) {
  const [selectedModel, setSelectedModel] = useState<ClaudeModel>(
    value || "claude-opus-4-5-20251101"
  );

  useEffect(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem("selectedClaudeModel");
    if (stored && MODELS.find((m) => m.id === stored)) {
      setSelectedModel(stored as ClaudeModel);
      onChange?.(stored as ClaudeModel);
    }
  }, [onChange]);

  useEffect(() => {
    if (value) {
      setSelectedModel(value);
    }
  }, [value]);

  const handleSelect = (model: ClaudeModel) => {
    setSelectedModel(model);
    localStorage.setItem("selectedClaudeModel", model);
    onChange?.(model);
  };

  const currentModel = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground",
            className
          )}
        >
          <ClaudeIcon className="h-4 w-4" />
          <span className="text-xs max-w-[80px] truncate hidden sm:inline">
            {currentModel.name.replace("Claude ", "")}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {MODELS.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => handleSelect(model.id)}
            className={cn(
              "flex items-center gap-3 py-2.5",
              selectedModel === model.id && "bg-primary/10"
            )}
          >
            <span
              className={cn(
                "text-muted-foreground",
                selectedModel === model.id && "text-primary"
              )}
            >
              {model.icon}
            </span>
            <div className="flex flex-col">
              <span
                className={cn(
                  "text-sm font-medium",
                  selectedModel === model.id && "text-primary"
                )}
              >
                {model.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {model.description}
              </span>
            </div>
            {selectedModel === model.id && (
              <div className="ml-auto h-2 w-2 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
