// import { NextRequest, NextResponse } from "next/server";
// import { AccessToken } from "livekit-server-sdk";

// export const runtime = "edge"; // works on Vercel Edge too

// export async function GET(req: NextRequest) {
//   const { searchParams } = new URL(req.url);

//   const room    = searchParams.get("room");
//   const userId  = searchParams.get("userId");
//   const userName = searchParams.get("userName") ?? "Player";

//   if (!room || !userId) {
//     return NextResponse.json({ error: "room and userId are required" }, { status: 400 });
//   }

//   const apiKey    = process.env.LIVEKIT_API_KEY;
//   const apiSecret = process.env.LIVEKIT_API_SECRET;

//   if (!apiKey || !apiSecret) {
//     return NextResponse.json(
//       { error: "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set" },
//       { status: 500 }
//     );
//   }

//   const token = new AccessToken(apiKey, apiSecret, {
//     identity: userId,
//     name: userName,
//     ttl: "4h",    // token valid for 4 hours — plenty for a poker session
//   });

//   token.addGrant({
//     room,
//     roomJoin: true,
//     canPublish: true,
//     canSubscribe: true,
//     canPublishData: true,
//   });

//   return NextResponse.json({ token: await token.toJwt() });
// }

import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const callSessionId = searchParams.get("callSessionId");

  if (!callSessionId) {
    return NextResponse.json(
      { error: "callSessionId is required" },
      { status: 400 },
    );
  }

  const { getToken } = await auth();
  const convexToken = await getToken({ template: "convex" });
  if (!convexToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_CONVEX_URL is not set" },
      { status: 500 },
    );
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(convexToken);

  const session = await convex.query(api.calls.getCallSession, {
    callSessionId: callSessionId as Id<"callSessions">,
  });

  if (!session) {
    return NextResponse.json(
      { error: "Call session not found or you're not part of it" },
      { status: 404 },
    );
  }
  if (session.status !== "accepted") {
    return NextResponse.json(
      { error: "This call hasn't been accepted yet" },
      { status: 403 },
    );
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set" },
      { status: 500 },
    );
  }

  const user = await currentUser();
  const displayName = user?.fullName ?? user?.username ?? user?.id ?? "Guest";

  const token = new AccessToken(apiKey, apiSecret, {
    identity: user?.id ?? "unknown",
    name: displayName,
    ttl: "2h",
  });

  token.addGrant({
    room: session.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return NextResponse.json({
    token: await token.toJwt(),
    url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    roomName: session.roomName,
  });
}
