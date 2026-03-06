import { AppData } from "@/lib/firecrawl/schema";

/**
 * Generate the system prompt for run-agent when recreating a stolen app
 * This prompt instructs Claude to recreate the app based on scraped data
 */
export function getAppStealerSystemPrompt(appData: AppData): string {
  const screenshotUrls = appData.screenshots?.map((s, i) => `${i + 1}. ${s.url}`).join("\n") || "None available";
  const features = appData.features?.map((f, i) => `${i + 1}. ${f}`).join("\n") || "General app functionality";
  const uiComponents = appData.uiComponents?.map((c) => `- ${c.type}: ${c.description}`).join("\n") || "Standard mobile UI";
  const reviewHighlights = appData.reviewHighlights?.map((r) => `- ${r}`).join("\n") || "No reviews available";

  return `
# APP RECREATION TASK

You are recreating the app "${appData.name}" based on comprehensive research data. Your goal is to build a fully functional React Native (Expo) app that captures the essence, functionality, and visual style of the original.

---

## APP OVERVIEW

| Field | Value |
|-------|-------|
| **Name** | ${appData.name} |
| **Developer** | ${appData.developer || "Unknown"} |
| **Category** | ${appData.category}${appData.subcategory ? ` > ${appData.subcategory}` : ""} |
| **Rating** | ${appData.rating ? `${appData.rating}/5 (${appData.ratingCount?.toLocaleString() || "N/A"} reviews)` : "N/A"} |
| **Pricing** | ${appData.pricingModel || "Unknown"}${appData.price ? ` - ${appData.price}` : ""}${appData.hasInAppPurchases ? " (has IAP)" : ""} |
| **Target Audience** | ${appData.targetAudience || "General users"} |
| **Age Rating** | ${appData.ageRating || "Not specified"} |

---

## DESCRIPTION

### Main Purpose
${appData.mainFunctionality}

### Full Description
${appData.description}

${appData.shortDescription ? `### Tagline\n"${appData.shortDescription}"` : ""}

---

## KEY FEATURES TO IMPLEMENT

${features}

---

## UI/UX DESIGN SPECIFICATIONS

### Navigation Pattern
**Style**: ${appData.navigationStyle || "tab_bar (recommended for most apps)"}

### Color Scheme
${
  appData.colorScheme
    ? `- **Primary**: ${appData.colorScheme.primary}
- **Secondary**: ${appData.colorScheme.secondary || "Derive from primary"}
- **Accent**: ${appData.colorScheme.accent || "Complementary to primary"}
- **Background**: ${appData.colorScheme.background || "#FFFFFF"}
- **Theme**: ${appData.colorScheme.isDark ? "Dark Mode" : "Light Mode"}`
    : "Use Apple HIG defaults with a clean, modern aesthetic"
}

### UI Components Identified
${uiComponents}

---

## VISUAL REFERENCES

### App Icon
${appData.iconUrl || "Generate a modern, minimalist icon matching the app's purpose"}

### Screenshots (Reference Only)
${screenshotUrls}

---

## USER FEEDBACK HIGHLIGHTS

${reviewHighlights}

---

# IMPLEMENTATION INSTRUCTIONS

## 1. Project Setup
- Use Expo SDK 54 with React Native
- Set up proper navigation structure (likely tab-based)
- Configure the color scheme in a theme file

## 2. Core Screens to Build
Based on the features and UI analysis, create these screens:
- Home/Dashboard screen
- Main feature screens (based on the features list)
- Settings/Profile screen
- Any additional screens needed for core functionality

## 3. Asset Generation
**CRITICAL**: Use the asset generation script for all visual assets:

\`\`\`bash
# Generate App Icon
node scripts/generate-asset.js --prompt "${appData.name} app icon, ${appData.category} category, minimalist, iOS style, ${appData.colorScheme?.primary || "modern gradient"}" --output ./assets/icon.png --background transparent --size 1024x1024

# Generate Splash Screen
node scripts/generate-asset.js --prompt "${appData.name} splash screen, ${appData.category} app, clean design, centered logo" --output ./assets/splash-icon.png --size 1024x1536

# Generate Adaptive Icon (Android)
node scripts/generate-asset.js --prompt "${appData.name} app icon centered, ${appData.category} style" --output ./assets/adaptive-icon.png --size 1024x1024
\`\`\`

## 4. State Management
- Use Zustand for global state
- Persist necessary data with AsyncStorage
- Keep state simple and focused

## 5. Styling Guidelines
- Use StyleSheet.create() for all styles
- Follow Apple Human Interface Guidelines
- Ensure proper safe areas and keyboard handling
- Support both light and dark modes if appropriate

## 6. Quality Requirements
- Smooth 60fps animations
- Proper loading states
- Error handling with user-friendly messages
- Accessibility support (VoiceOver, Dynamic Type)

---

## WHAT NOT TO DO

- Do NOT just create placeholder screens - build real functionality
- Do NOT skip the asset generation - use the scripts
- Do NOT hardcode text - use proper constants
- Do NOT ignore the color scheme - match it closely
- Do NOT create a generic app - make it feel like "${appData.name}"

---

## START BUILDING

Begin by:
1. Setting up the navigation structure
2. Creating the main screens
3. Implementing the core features
4. Generating and applying assets
5. Polishing the UI to match the reference

Remember: The goal is to recreate a production-quality app that captures what makes "${appData.name}" great. Focus on the user experience and visual polish.
`;
}

/**
 * Generate a shorter summary message for chat display
 */
export function getAppStealerSummary(appData: AppData): string {
  const screenshotCount = appData.screenshots?.length || 0;
  const featureCount = appData.features?.length || 0;

  let summary = `## Research Complete: ${appData.name}\n\n`;
  summary += `| Field | Value |\n`;
  summary += `|-------|-------|\n`;
  summary += `| **Category** | ${appData.category} |\n`;
  summary += `| **Developer** | ${appData.developer || "Unknown"} |\n`;
  summary += `| **Rating** | ${appData.rating ? `${appData.rating}/5` : "N/A"} |\n`;
  summary += `| **Features Found** | ${featureCount} |\n`;
  summary += `| **Screenshots** | ${screenshotCount} |\n`;

  if (appData.colorScheme?.primary) {
    summary += `| **Primary Color** | ${appData.colorScheme.primary} |\n`;
  }
  if (appData.navigationStyle) {
    summary += `| **Navigation** | ${appData.navigationStyle.replace("_", " ")} |\n`;
  }
  if (appData.pricingModel) {
    summary += `| **Pricing** | ${appData.pricingModel} |\n`;
  }

  summary += `\n### Main Purpose\n${appData.mainFunctionality}\n`;

  if (appData.shortDescription) {
    summary += `\n> "${appData.shortDescription}"\n`;
  }

  return summary;
}

/**
 * Build the Firecrawl prompt based on input type
 */
export function getFirecrawlPrompt(input: string, inputType: "name" | "appstore" | "playstore" | "website"): string {
  const baseInstructions = `
Extract the following information:
- App name exactly as displayed
- Developer/company name
- Category and subcategory
- Full description text
- A one-sentence summary of what the app does
- All key features mentioned (as a list)
- Star rating and review count
- App icon URL (highest quality)
- All screenshot URLs in order
- Color scheme (primary, secondary colors from screenshots)
- Navigation style (tab bar, drawer, etc.)
- Pricing model and any mentioned prices
- Target audience description
- Age rating
`;

  switch (inputType) {
    case "name":
      return `Find comprehensive information about the mobile app called "${input}".

Search the iOS App Store, Google Play Store, and the app's official website if available.

${baseInstructions}

Analyze any screenshots found to identify:
- Main UI components (headers, tab bars, lists, cards, etc.)
- Color scheme and visual style
- Navigation patterns

Prioritize App Store data if available, then Play Store, then website.`;

    case "appstore":
      return `Extract all information from this iOS App Store listing: ${input}

${baseInstructions}

Also identify:
- What's New section highlights
- App previews/videos if available
- In-app purchase details
- Privacy information

Analyze all screenshots to understand the app's UI patterns and visual design.`;

    case "playstore":
      return `Extract all information from this Google Play Store listing: ${input}

${baseInstructions}

Also identify:
- Recent changes/updates
- Data safety information
- Similar apps section
- Developer contact info

Analyze all screenshots to understand the app's UI patterns and visual design.`;

    case "website":
      return `This is a website for a mobile app or web application: ${input}

Extract information about the app/product:
- Product/app name
- Company or developer
- What the product does (main functionality)
- Key features and benefits
- Any screenshots or mockups shown
- Color scheme and branding
- Pricing information
- Target audience
- Call-to-action text and value propositions

Look for:
- Hero sections
- Feature lists
- Pricing tables
- Testimonials
- App store badges/links`;
  }
}
