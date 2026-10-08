/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as ageVerification from "../ageVerification.js";
import type * as assets from "../assets.js";
import type * as bookings from "../bookings.js";
import type * as calendar from "../calendar.js";
import type * as callAccess from "../callAccess.js";
import type * as calls from "../calls.js";
import type * as gallery from "../gallery.js";
import type * as gifts from "../gifts.js";
import type * as hostAccess from "../hostAccess.js";
import type * as hostPayout from "../hostPayout.js";
import type * as hosts from "../hosts.js";
import type * as http from "../http.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_availability from "../lib/availability.js";
import type * as lib_fees from "../lib/fees.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_schedule from "../lib/schedule.js";
import type * as lib_slots from "../lib/slots.js";
import type * as likes from "../likes.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as payments from "../payments.js";
import type * as payouts from "../payouts.js";
import type * as profiles from "../profiles.js";
import type * as roles from "../roles.js";
import type * as tokenPayments from "../tokenPayments.js";
import type * as tokens from "../tokens.js";
import type * as uploads from "../uploads.js";
import type * as user from "../user.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  ageVerification: typeof ageVerification;
  assets: typeof assets;
  bookings: typeof bookings;
  calendar: typeof calendar;
  callAccess: typeof callAccess;
  calls: typeof calls;
  gallery: typeof gallery;
  gifts: typeof gifts;
  hostAccess: typeof hostAccess;
  hostPayout: typeof hostPayout;
  hosts: typeof hosts;
  http: typeof http;
  "lib/auth": typeof lib_auth;
  "lib/availability": typeof lib_availability;
  "lib/fees": typeof lib_fees;
  "lib/geo": typeof lib_geo;
  "lib/schedule": typeof lib_schedule;
  "lib/slots": typeof lib_slots;
  likes: typeof likes;
  messages: typeof messages;
  notifications: typeof notifications;
  payments: typeof payments;
  payouts: typeof payouts;
  profiles: typeof profiles;
  roles: typeof roles;
  tokenPayments: typeof tokenPayments;
  tokens: typeof tokens;
  uploads: typeof uploads;
  user: typeof user;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
