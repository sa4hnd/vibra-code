/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as admin from "../admin.js";
import type * as audios from "../audios.js";
import type * as billing from "../billing.js";
import type * as billingSwitch from "../billingSwitch.js";
import type * as costs from "../costs.js";
import type * as credits from "../credits.js";
import type * as files from "../files.js";
import type * as github from "../github.js";
import type * as http from "../http.js";
import type * as images from "../images.js";
import type * as messages from "../messages.js";
import type * as migrations from "../migrations.js";
import type * as paymentTransactions from "../paymentTransactions.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as revenuecat from "../revenuecat.js";
import type * as sandbox from "../sandbox.js";
import type * as scheduled from "../scheduled.js";
import type * as sessions from "../sessions.js";
import type * as stolenApps from "../stolenApps.js";
import type * as usage from "../usage.js";
import type * as videos from "../videos.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  audios: typeof audios;
  billing: typeof billing;
  billingSwitch: typeof billingSwitch;
  costs: typeof costs;
  credits: typeof credits;
  files: typeof files;
  github: typeof github;
  http: typeof http;
  images: typeof images;
  messages: typeof messages;
  migrations: typeof migrations;
  paymentTransactions: typeof paymentTransactions;
  pushNotifications: typeof pushNotifications;
  revenuecat: typeof revenuecat;
  sandbox: typeof sandbox;
  scheduled: typeof scheduled;
  sessions: typeof sessions;
  stolenApps: typeof stolenApps;
  usage: typeof usage;
  videos: typeof videos;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
