import { z } from "zod";

/**
 * Zod schema for app data extraction via Firecrawl Agent API
 * Used to structure the response from scraping App Store, Play Store, or website
 */

export const AppScreenshotSchema = z.object({
  url: z.string().url().describe("Screenshot image URL"),
  alt: z.string().optional().describe("Alt text or caption for the screenshot"),
  order: z.number().optional().describe("Display order (1-10)"),
});

export const AppUIComponentSchema = z.object({
  type: z.enum([
    "header",
    "tab_bar",
    "list",
    "card",
    "button",
    "search",
    "profile",
    "settings",
    "chart",
    "calendar",
    "map",
    "carousel",
    "form",
    "modal",
    "navigation_drawer",
  ]).describe("Type of UI component"),
  description: z.string().describe("What this component shows or does"),
  position: z.enum(["top", "bottom", "center", "floating"]).optional().describe("Position in the layout"),
});

export const AppColorSchemeSchema = z.object({
  primary: z.string().describe("Primary brand color (hex code like #FF5500)"),
  secondary: z.string().optional().describe("Secondary color (hex)"),
  accent: z.string().optional().describe("Accent color (hex)"),
  background: z.string().optional().describe("Main background color"),
  isDark: z.boolean().optional().describe("Whether app uses dark mode primarily"),
});

export const AppDataSchema = z.object({
  // Basic Info
  name: z.string().describe("App name as displayed in store"),
  developer: z.string().optional().describe("Developer or company name"),
  developerId: z.string().optional().describe("Developer ID from store"),

  // Categorization
  category: z.string().describe("Primary category (e.g., 'Health & Fitness', 'Productivity')"),
  subcategory: z.string().optional().describe("Secondary category if applicable"),

  // Descriptions
  description: z.string().describe("Full app description from the store listing"),
  shortDescription: z.string().optional().describe("Tagline or short marketing text (under 100 chars)"),

  // Features
  features: z.array(z.string()).describe("List of key features (5-15 items)"),
  mainFunctionality: z.string().describe("What the app primarily does in one sentence"),

  // Ratings & Reviews
  rating: z.number().min(1).max(5).optional().describe("Average rating (1-5 stars)"),
  ratingCount: z.number().optional().describe("Total number of ratings"),
  reviewHighlights: z.array(z.string()).optional().describe("Key points from top reviews"),

  // Visual Assets
  iconUrl: z.string().url().optional().describe("App icon URL (highest resolution available)"),
  screenshots: z.array(AppScreenshotSchema).max(10).optional().describe("Screenshot URLs in order"),

  // UI Analysis (from screenshots)
  uiComponents: z.array(AppUIComponentSchema).optional().describe("Main UI components visible in screenshots"),
  colorScheme: AppColorSchemeSchema.optional().describe("App color scheme based on screenshots"),
  navigationStyle: z.enum(["tab_bar", "drawer", "stack_only", "custom"]).optional().describe("Primary navigation pattern"),

  // Technical Details
  version: z.string().optional().describe("Current version number"),
  lastUpdated: z.string().optional().describe("Last update date"),
  size: z.string().optional().describe("App size (e.g., '45 MB')"),
  minimumOS: z.string().optional().describe("Minimum OS version required"),

  // Business Model
  requiresSubscription: z.boolean().optional().describe("Whether subscription is required"),
  hasInAppPurchases: z.boolean().optional().describe("Has in-app purchases"),
  pricingModel: z.enum(["free", "freemium", "paid", "subscription"]).optional().describe("Pricing model"),
  price: z.string().optional().describe("Price if paid (e.g., '$4.99')"),

  // Platform
  platforms: z.array(z.enum(["ios", "android", "web", "macos", "watchos"])).optional().describe("Supported platforms"),

  // Target Audience
  targetAudience: z.string().optional().describe("Who the app is designed for"),
  ageRating: z.string().optional().describe("Age rating (e.g., '4+', '12+')"),

  // Source
  sourceUrl: z.string().url().optional().describe("Original URL where data was found"),
  storeType: z.enum(["app_store", "play_store", "website", "unknown"]).optional().describe("Source type"),
});

export type AppData = z.infer<typeof AppDataSchema>;
export type AppScreenshot = z.infer<typeof AppScreenshotSchema>;
export type AppUIComponent = z.infer<typeof AppUIComponentSchema>;
export type AppColorScheme = z.infer<typeof AppColorSchemeSchema>;

/**
 * Convert Zod schema to JSON Schema for Firecrawl API
 */
export function getAppDataJsonSchema() {
  // Firecrawl expects a simplified JSON schema format
  return {
    type: "object",
    properties: {
      name: { type: "string", description: "App name as displayed in store" },
      developer: { type: "string", description: "Developer or company name" },
      category: { type: "string", description: "Primary category" },
      description: { type: "string", description: "Full app description" },
      shortDescription: { type: "string", description: "Tagline or short marketing text" },
      features: {
        type: "array",
        items: { type: "string" },
        description: "List of key features (5-15 items)",
      },
      mainFunctionality: { type: "string", description: "What the app primarily does" },
      rating: { type: "number", description: "Average rating 1-5" },
      ratingCount: { type: "number", description: "Total number of ratings" },
      iconUrl: { type: "string", description: "App icon URL" },
      screenshots: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string", description: "Screenshot URL" },
            alt: { type: "string", description: "Screenshot description" },
          },
          required: ["url"],
        },
        description: "Screenshot URLs in order",
      },
      colorScheme: {
        type: "object",
        properties: {
          primary: { type: "string", description: "Primary brand color (hex)" },
          secondary: { type: "string", description: "Secondary color" },
          isDark: { type: "boolean", description: "Uses dark mode" },
        },
        description: "App color scheme",
      },
      navigationStyle: {
        type: "string",
        enum: ["tab_bar", "drawer", "stack_only", "custom"],
        description: "Navigation pattern",
      },
      pricingModel: {
        type: "string",
        enum: ["free", "freemium", "paid", "subscription"],
        description: "Pricing model",
      },
      hasInAppPurchases: { type: "boolean", description: "Has in-app purchases" },
      targetAudience: { type: "string", description: "Target audience" },
      sourceUrl: { type: "string", description: "Source URL" },
      storeType: {
        type: "string",
        enum: ["app_store", "play_store", "website", "unknown"],
        description: "Source type",
      },
    },
    required: ["name", "category", "description", "features", "mainFunctionality"],
  };
}
