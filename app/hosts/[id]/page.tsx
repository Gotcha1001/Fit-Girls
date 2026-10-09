"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { tzLabel } from "@/convex/lib/schedule";
import { useNow } from "@/hooks/useNow";
import { useViewerTz } from "@/hooks/useViewerTz";

import { GiftPicker } from "@/app/components/GiftPicker";
import { DualClock } from "@/app/components/DualClock";
import { BookCallPanel } from "@/app/components/booking/BookCallPanel";

export default function HostProfilePage() {
  const { id } = useParams<{ id: string }>();
  const host = useQuery(api.hosts.getPublic, { hostId: id });
  const me = useQuery(api.user.getMe);
  // Hooks must stay above the early returns below.
  const viewerTz = useViewerTz();
  const now = useNow(60_000);

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
        <h2 className="mb-2 text-lg font-semibold">Book a call</h2>

        {host.timezone ? (
          <>
            <h2 className="mb-3 text-sm font-medium text-amber-300">
              These are {host.displayName}&apos;s times (
              {tzLabel(host.timezone, now)})
            </h2>
            <div className="mb-4">
              <DualClock
                primaryTz={host.timezone}
                primaryLabel="Her time"
                otherTz={viewerTz}
                otherLabel="Your time"
              />
            </div>
            <BookCallPanel
              hostId={host._id}
              hostTz={host.timezone}
              ratePerMinuteCents={host.ratePerMinuteCents}
              minMinutes={host.minMinutes}
            />
          </>
        ) : (
          <p className="text-sm text-zinc-400">
            This host hasn&apos;t set her time zone yet, so booking isn&apos;t
            available.
          </p>
        )}
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
