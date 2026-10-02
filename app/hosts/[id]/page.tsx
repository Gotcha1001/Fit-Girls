"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookingPicker } from "@/app/components/BookingPicker";

export default function HostProfilePage() {
  const { id } = useParams<{ id: string }>();
  const host = useQuery(api.hosts.getPublic, { hostId: id });

  if (host === undefined) return <p className="p-8">Loading…</p>;
  if (host === null) return <p className="p-8">Host not found.</p>;

  return (
    <main className="mx-auto grid max-w-5xl gap-8 p-6 md:grid-cols-2">
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
      <BookingPicker
        hostId={host._id}
        ratePerMinuteCents={host.ratePerMinuteCents}
        minMinutes={host.minMinutes}
      />
    </main>
  );
}
