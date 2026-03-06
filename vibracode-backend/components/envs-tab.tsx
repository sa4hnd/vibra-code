"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { EnvsManager } from "@/components/envs-manager";

interface EnvsTabProps {
  session?: Doc<"sessions">;
}

export default function EnvsTab({ session }: EnvsTabProps) {
  return (
    <div className="flex-1 h-full flex flex-col">
      <EnvsManager session={session} />
    </div>
  );
}
