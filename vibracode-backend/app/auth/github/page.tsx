"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { saveGitHubCredentials } from "@/app/actions/github-push";
import { Loader2 } from "lucide-react";

function GitHubAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  useEffect(() => {
    // If not authenticated with NextAuth, trigger GitHub OAuth
    if (status === "unauthenticated") {
      signIn("github", { callbackUrl: `/auth/github?callbackUrl=${encodeURIComponent(callbackUrl)}` });
      return;
    }

    // If authenticated, save credentials to Convex
    if (status === "authenticated" && session?.accessToken && !saving) {
      setSaving(true);
      saveGitHubCredentials()
        .then((result) => {
          if (result.success) {
            router.push(callbackUrl);
          } else {
            setError(result.error || "Failed to save GitHub credentials");
          }
        })
        .catch((err) => {
          setError(err.message || "Failed to save GitHub credentials");
        });
    }
  }, [status, session, callbackUrl, router, saving]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold text-red-500">Connection Failed</h1>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => router.push(callbackUrl)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="text-muted-foreground">Connecting to GitHub...</p>
      </div>
    </div>
  );
}

export default function GitHubAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <GitHubAuthContent />
    </Suspense>
  );
}
