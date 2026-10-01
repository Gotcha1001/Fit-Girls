"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function BookingPage() {
  const { id } = useParams<{ id: string }>();
  const booking = useQuery(api.bookings.getMine, {
    bookingId: id as Id<"bookings">,
  });

  if (booking === undefined) return <p className="p-8">Loading…</p>;
  if (booking === null) return <p className="p-8">Booking not found.</p>;

  const when = new Date(booking.startsAt).toLocaleString();

  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-2xl font-bold">Booking with {booking.hostName}</h1>
      <p>
        {when} · {booking.minutes} minutes
      </p>

      {booking.status === "pending_payment" && (
        <p className="rounded-lg bg-yellow-500/10 p-4 text-yellow-300">
          Confirming your payment… this page updates automatically.
        </p>
      )}

      {booking.status === "paid" && (
        <Link
          href={`/call/${booking._id}`}
          className="block rounded-xl bg-pink-600 py-3 text-center font-semibold"
        >
          Join call
        </Link>
      )}

      {booking.status === "cancelled" && (
        <p className="text-red-400">This booking was cancelled.</p>
      )}
    </main>
  );
}
