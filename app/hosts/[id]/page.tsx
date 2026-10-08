"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

import { GiftPicker } from "@/app/components/GiftPicker";
import { BookCallPanel } from "@/app/components/BookCallPanel";

export default function HostProfilePage() {
  const { id } = useParams<{ id: string }>();
  const host = useQuery(api.hosts.getPublic, { hostId: id });
  const me = useQuery(api.user.getMe);

  if (host === undefined) return <p className="p-8">Loading…</p>;
  if (host === null) return <p className="p-8">Host not found.</p>;

  // Only clients can send gifts (the server enforces this too).
  const canGift = me?.role === "user" && me.onboardingChoice === "client";

  return (
    <main className="mx-auto grid max-w-5xl gap-8 p-6 md:grid-cols-2">
      {/* Profile */}
      <div>
        {host.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={host.avatarUrl}
            alt={host.displayName}
            className="w-full rounded-2xl"
          />
        )}
        <h1 className="mt-4 text-3xl font-bold">{host.displayName}</h1>
        {host.bio && <p className="mt-2 text-neutral-300">{host.bio}</p>}
      </div>

      {/* Booking — calendar + duration + pay */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Book a call</h2>
        <BookCallPanel
          hostId={host._id}
          ratePerMinuteCents={host.ratePerMinuteCents}
          minMinutes={host.minMinutes}
        />
      </div>

      {/* Gifts: stacked under booking on mobile, full-width row below both columns on desktop */}
      {canGift && (
        <div className="md:col-span-2">
          <GiftPicker toUserId={host.userId} />
        </div>
      )}
    </main>
  );
}
