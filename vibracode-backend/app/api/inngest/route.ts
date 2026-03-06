import { serve } from "inngest/next";
import { inngest, runAgent, createSession, pushToGitHub, generateVideo, generateImage, stealApp } from "@/lib/inngest";

export const maxDuration = 900; // 15 minutes (GCloud has no timeout limit)

// Create an API that serves all Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    runAgent,
    createSession,
    pushToGitHub,
    generateVideo, // Video generation with Sora 2
    generateImage, // Image generation with GPT Image 1.5
    stealApp, // App Stealer - research and recreate apps
  ],
});