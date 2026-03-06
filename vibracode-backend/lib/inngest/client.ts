import { Inngest } from "inngest";
import { realtimeMiddleware, channel, topic } from "@inngest/realtime";

// Create a client to send and receive events
// Inngest auto-detects dev mode based on INNGEST_SIGNING_KEY presence
export const inngest = new Inngest({
  id: "vibracode",
  middleware: [realtimeMiddleware()],
});

export const sessionChannel = channel("sessions")
  .addTopic(
    topic("status").type<{
      status:
        | "IN_PROGRESS"
        | "CLONING_REPO"
        | "INSTALLING_DEPENDENCIES"
        | "STARTING_DEV_SERVER"
        | "CREATING_TUNNEL"
        | "RUNNING"
        | "SETTING_UP_SANDBOX"
        | "INITIALIZING_GIT"
        | "ADDING_FILES"
        | "COMMITTING_CHANGES";
      sessionId: string;
      id: string;
    }>()
  )
  .addTopic(
    topic("update").type<{
      sessionId: string;
      message: Record<string, unknown>;
    }>()
  );

let app: Inngest | undefined;

export const getInngestApp = () => {
  return (app ??= new Inngest({
    id: typeof window !== "undefined" ? "client" : "server",
    middleware: [realtimeMiddleware()],
  }));
};
