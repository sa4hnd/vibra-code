"use client";

import { Code } from "lucide-react";
import { templates } from "@/config";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TemplateSelectorProps {
  selectedTemplate: string;
  onTemplateChange: (templateId: string) => void;
  disabled?: boolean;
}

export function TemplateSelector({ 
  selectedTemplate, 
  onTemplateChange, 
  disabled 
}: TemplateSelectorProps) {
  return (
    <Select
      onValueChange={onTemplateChange}
      value={selectedTemplate}
      disabled={disabled}
    >
      <SelectTrigger className="w-[200px] bg-white/10 border-white/20 text-white">
        <SelectValue placeholder="Expo React Native" className="text-white/60" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Templates</SelectLabel>
          {templates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                <span className="font-medium">{template.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

