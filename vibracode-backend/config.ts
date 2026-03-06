export interface Template {
  id: string;
  name: string;
  description: string;
  repository: string;
  logos: string[];
  image?: string;
  startCommands: {
    command: string;
    status: "INSTALLING_DEPENDENCIES" | "STARTING_DEV_SERVER";
    background?: boolean;
  }[];
  secrets?: Record<string, string>;
  systemPrompt: string;
}

export const templates: Template[] = [
  {
    id: "expo",
    name: "Expo React Native",
    description:
      "Build cross-platform mobile apps with Expo SDK, TypeScript, and NativeWind styling.",
    repository: "https://github.com/sa4hnd/expo-template",
    logos: ["expo.svg"], // Using nextjs.svg as placeholder since we don't have expo.svg
    image: "YOUR_E2B_TEMPLATE_ID", // Custom E2B template ID (vibracode-expo-cursor-v2)
    startCommands: [
      {
        command: 
        "echo fs.inotify.max_user_watches=524288 >> /etc/sysctl.conf && sysctl -p && npx expo start --tunnel --port 3000",
        status: "STARTING_DEV_SERVER",
        background: true,
      },
    ],
    systemPrompt: "FILE:system-prompt.md", // Reference to external prompt file
  },
  {
    id: "nextjs",
    name: "Next.js",
    description:
      "Build scalable web applications with server-side rendering, static site generation, and API routes",
    repository: "https://github.com/superagent-ai/e2b-nextjs",
    logos: ["nextjs.svg"],
    startCommands: [
      {
        command: "npm i",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "npm run dev",
        status: "STARTING_DEV_SERVER",
        background: true,
      },
    ],
    systemPrompt:
      "# GOAL\nYou are an helpful assistant that is tasked with helping the user build a NextJS app.\n" +
      "- The NextJS dev server is running on port 3000.\n" +
      "- ShadCN UI is installed, togehter with all the ShadCN components.\n",
  },
  {
    id: "nextjs-supabase-auth",
    name: "Next.js + Supabase + Auth",
    description:
      "Build a production-ready SaaS with authentication, database, and real-time features out of the box",
    repository:
      "https://github.com/vercel/next.js/tree/canary/examples/with-supabase",
    logos: ["nextjs.svg", "supabase.jpeg"],
    startCommands: [
      {
        command: "npm i",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "npm run dev",
        status: "STARTING_DEV_SERVER",
        background: true,
      },
    ],
    systemPrompt:
      "# GOAL\nYou are an helpful assistant that is tasked with helping the user build a NextJS app.\n" +
      "- The NextJS dev server is running on port 3000.\n" +
      "- ShadCN UI is installed, togehter with all the ShadCN components.\n" +
      "- Supabase CLI and Auth is installed and ready to be used if needed.\n",
  },
  {
    id: "nextjs-convex-clerk",
    name: "Next.js + Convex + Clerk",
    description:
      "Create collaborative apps with real-time sync, instant auth, and seamless user management",
    repository: "https://github.com/get-convex/convex-clerk-users-table",
    logos: ["nextjs.svg", "convex.webp", "clerk.svg"],
    startCommands: [
      {
        command: "npm i",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "npm run dev",
        status: "STARTING_DEV_SERVER",
        background: true,
      },
      {
        command: "CONVEX_AGENT_MODE=anonymous npx convex dev",
        status: "STARTING_DEV_SERVER",
        background: true,
      },
    ],
    systemPrompt:
      "# GOAL\nYou are an helpful assistant that is tasked with helping the user build a NextJS app.\n" +
      "- The NextJS dev server is running on port 3000.\n" +
      "- The convex command npx convex dev is running\n" +
      "- ShadCN UI is installed, togehter with all the ShadCN components.\n" +
      "- Convex CLI is is installed and ready to be used if needed.\n",
  },
  {
    id: "shopify-hydrogen",
    name: "Shopify",
    description:
      "Build fast headless commerce storefronts with Shopify's official framework Hydrogen.",
    repository: "superagent-ai/e2b-shopify",
    logos: ["shopify.jpeg"],
    startCommands: [
      {
        command: "npm i",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "npm i -g @shopify/cli@latest",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "echo 'SESSION_SECRET=\"foobar\"' > .env",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "shopify hydrogen dev --codegen --host",
        background: true,
        status: "STARTING_DEV_SERVER",
      },
    ],
    secrets: {
      SESSION_SECRET: "foobar",
    },
    systemPrompt:
      "# GOAL\nYou are an helpful assistant that is tasked with helping the user build a Shopify Hydrogen app.\n" +
      "- The hydrogen server is running on port 3000.\n" +
      "- The Shopify CLI is installed and ready to be used if needed.\n",
  },
  {
    id: "fastapi-nextjs",
    name: "FastAPI + Next.js",
    description:
      "Build modern full-stack apps with FastAPI backend and Next.js frontend.",
    repository: "tiangolo/full-stack-fastapi-template",
    logos: ["nextjs.svg", "fastapi.jpg"],
    startCommands: [
      {
        command: "npm i",
        status: "INSTALLING_DEPENDENCIES",
      },
      {
        command: "npm run dev",
        status: "STARTING_DEV_SERVER",
        background: true,
      },
    ],
    systemPrompt:
      "# GOAL\nYou are an helpful assistant that is tasked with helping the user build a FastAPI and Next.js app.\n" +
      "- The NextJS dev server is running on port 3000.\n" +
      "- The FastAPI server is running on port 8000.\n" +
      "- ShadCN UI is installed, togehter with all the ShadCN components.\n",
  },
];
