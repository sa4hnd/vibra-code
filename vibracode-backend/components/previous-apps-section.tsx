"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ProjectHighlightCard from "@/components/ui/project-highlight-card";

function AppCard({
  session,
  onSelect,
}: {
  session: {
    id: string;
    name: string;
    status: string;
    _creationTime: number;
    templateId?: string;
  };
  onSelect: (id: string) => void;
}) {
  return (
    <ProjectHighlightCard
      title={session.name}
      templateId={session.templateId}
      createdAt={session._creationTime}
      onClick={() => onSelect(session.id)}
    />
  );
}

export default function PreviousAppsSection({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const { user, isSignedIn } = useUser();
  const sessions = useQuery(
    api.sessions.list,
    isSignedIn && user?.id
      ? {
          createdBy: user.id,
        }
      : "skip"
  );

  if (!sessions) {
    return (
      <div className="flex flex-col gap-y-4 max-w-6xl w-full mx-auto md:px-0 px-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">My Projects</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] w-[180px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Show only recent sessions (last 8)
  const recentSessions = sessions.slice(0, 8);

  if (recentSessions.length === 0) {
    return (
      <div className="flex flex-col gap-y-4 max-w-6xl w-full mx-auto md:px-0 px-4">
        <div className="flex items-center justify-between">
          <p className="font-medium">My Projects</p>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No projects yet</p>
          <p className="text-muted-foreground text-xs mt-1">
            Start building to see your projects here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-4 max-w-6xl w-full mx-auto md:px-0 px-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">My Projects</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.href = "/sessions"}
        >
          View All
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
        {recentSessions.map((session) => (
          <AppCard
            key={session.id}
            session={session}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
