"use client";

import * as React from "react";
import { Moon } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  return (
    <DropdownMenuItem disabled className="font-medium">
      <Moon className="mr-2 h-4 w-4" />
      Dark mode (Always on)
    </DropdownMenuItem>
  );
}
