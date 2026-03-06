"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";

import { api } from "@/convex/_generated/api";

import { SignInPage, Testimonial } from "@/components/ui/sign-in";
import { HeroWave } from "@/components/ui/ai-input-hero";
import { Footer } from "@/components/ui/footer";
import { createSessionAction } from "./actions/vibrakit";
import { Repo } from "./actions/github";
import { templates } from "@/config";

const PENDING_PROMPT_KEY = "vibra_pending_prompt";

export default function ClientPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState<string>("");
  const router = useRouter();
  const createSession = useMutation(api.sessions.create);
  const addMessage = useMutation(api.messages.add);
  const hasCheckedPendingPrompt = useRef(false);

  // Check for pending prompt after sign-in
  useEffect(() => {
    if (isLoaded && isSignedIn && !hasCheckedPendingPrompt.current) {
      hasCheckedPendingPrompt.current = true;
      const pendingPrompt = localStorage.getItem(PENDING_PROMPT_KEY);
      if (pendingPrompt) {
        // Restore the prompt
        setInitialPrompt(pendingPrompt);
        // Clear from storage
        localStorage.removeItem(PENDING_PROMPT_KEY);
      }
    }
  }, [isLoaded, isSignedIn]);

  const sampleTestimonials: Testimonial[] = [
    {
      avatarSrc: "https://randomuser.me/api/portraits/women/57.jpg",
      name: "Sarah Chen",
      handle: "@sarahdigital",
      text: "Amazing platform! The user experience is seamless and the features are exactly what I needed."
    },
    {
      avatarSrc: "https://randomuser.me/api/portraits/men/64.jpg",
      name: "Marcus Johnson",
      handle: "@marcustech",
      text: "This service has transformed how I work. Clean design, powerful features, and excellent support."
    },
    {
      avatarSrc: "https://randomuser.me/api/portraits/men/32.jpg",
      name: "David Martinez",
      handle: "@davidcreates",
      text: "I've tried many platforms, but this one stands out. Intuitive, reliable, and genuinely helpful for productivity."
    },
  ];

  const handleChatSubmit = useCallback(async (message: string, repository?: Repo, imageData?: any, templateId?: string) => {
    if (!isSignedIn) {
      // Store the prompt before opening sign-in
      localStorage.setItem(PENDING_PROMPT_KEY, message);
      setIsSignInOpen(true);
      return;
    }

    // Use selected template or default to expo
    const selectedTemplate = templateId || "expo";
    const template = templates.find((t) => t.id === selectedTemplate);

    const sessionParams = {
      name: "Untitled",
      status: "IN_PROGRESS" as const,
      createdBy: user?.id,
      templateId: selectedTemplate,
      ...(repository && { repository: repository.full_name }),
    };

    const sessionId = await createSession(sessionParams);

    const actionParams = {
      sessionId,
      message,
      ...(repository
        ? { repository: repository.full_name }
        : { template: template }),
    };

    await createSessionAction(actionParams);

    await addMessage({
      sessionId,
      role: "user",
      content: message,
    });

    router.push(`/session/${sessionId}`);
  }, [isSignedIn, user?.id, createSession, addMessage, router]);


  return (
    <div className="min-h-screen flex flex-col">
      <SignInPage
        testimonials={sampleTestimonials}
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
      />
      <div className="flex-1">
        <HeroWave
          title="Create your next mobile masterpiece"
          subtitle="The AI Mobile App Builder. Create iOS and Android apps instantly"
          placeholder="Describe the mobile app you want to create..."
          buttonText="Build Mobile App"
          onPromptSubmit={handleChatSubmit}
          initialPrompt={initialPrompt}
        />
      </div>
      <Footer />
    </div>
  );
}
