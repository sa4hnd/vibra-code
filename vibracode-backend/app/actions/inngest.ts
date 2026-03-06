"use server";
import { getSubscriptionToken, Realtime } from "@inngest/realtime";

import { getInngestApp, sessionChannel } from "@/lib/inngest";

export type SessionChannelToken = Realtime.Token<
  typeof sessionChannel,
  ["status", "update"]
>;

export async function fetchRealtimeSubscriptionToken(): Promise<SessionChannelToken> {
  const token = await getSubscriptionToken(getInngestApp(), {
    channel: sessionChannel(),
    topics: ["status", "update"],
  });

  return token;
}
