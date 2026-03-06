"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { GitPullRequest, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPullRequestAction } from "@/app/actions/vibrakit";
import { Id } from "@/convex/_generated/dataModel";

interface PullRequestButtonProps {
  sessionId: string;
  sessionData: {
    sessionId?: string;
    repository?: string;
    pullRequest?: any;
    status: string;
  };
  isHome: boolean;
}

export function PullRequestButton({ sessionId, sessionData, isHome }: PullRequestButtonProps) {
  const [isCreatingPullRequest, setIsCreatingPullRequest] = useState<boolean>(false);

  const handleCreatePullRequest = useCallback(async () => {
    if (!sessionData.sessionId || !sessionData.repository) {
      console.error("Missing sessionId or repository");
      return;
    }
    
    setIsCreatingPullRequest(true);
    try {
      const pr = await createPullRequestAction({
        id: sessionId as Id<"sessions">,
        sessionId: sessionData.sessionId,
        repository: sessionData.repository,
      });
      console.log(pr);
    } finally {
      setIsCreatingPullRequest(false);
    }
  }, [sessionData, sessionId]);

  if (sessionData.pullRequest && !isHome) {
    return (
      <Link href={sessionData.pullRequest.html_url} target="_blank">
        <Button variant="outline" className="h-8">
          <GitPullRequest />
          View Pull Request
        </Button>
      </Link>
    );
  }

  if (!sessionData.pullRequest && !isHome) {
    return (
      <Button
        variant="outline"
        className="h-8"
        onClick={handleCreatePullRequest}
        disabled={isCreatingPullRequest || sessionData.status !== "RUNNING"}
      >
        {isCreatingPullRequest ? (
          <Loader className="animate-spin" />
        ) : (
          <GitPullRequest />
        )}
        Create Pull Request
      </Button>
    );
  }

  return null;
}
