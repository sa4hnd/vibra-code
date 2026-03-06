"use server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

export async function generateSessionTitle(prompt: string) {
  const openai = createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY!,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const response = await generateObject({
    model: openai("anthropic/claude-3.5-sonnet"),
    schema: z.object({
      title: z.string(),
    }),
    prompt:
      `Generate a title for a session based on the following prompt: ${prompt}\n` +
      "Maximum of three words.",
  });

  return response.object.title;
}
