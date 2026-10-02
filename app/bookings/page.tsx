"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type Row = {
  _id: string;
  startsAt: number;
  endsAt: number;
  minutes: number;
  status: string;
  otherName: string;
  callSessionId: string | null;
  amountCents?: number; // guest side
  hostShareCents?: number; // host side
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  completed: "Completed",
  refunded: "Refunded",
};

const STATUS_STYLE: Record<string, string> = {
  pending_payment: "bg-yellow-500/10 text-yellow-300",
  paid: "bg-green-500/10 text-green-300",
  completed: "bg-neutral-500/20 text-neutral-300",
  refunded: "bg-neutral-500/20 text-neutral-300",
};

const rand = (cents: number): string => `R${(cents / 100).toFixed(2)}`;

function BookingRow({ row, side }: { row: Row; side: "guest" | "host" }) {
  const when = new Date(row.startsAt).toLocaleString();
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="min-w-0">
        <p className="font-semibold">
          {side === "guest" ? "Call with" : "Booked by"} {row.otherName}
        </p>
        <p className="text-sm text-neutral-400">
          {when} · {row.minutes} min
          {side === "guest" && row.amountCents !== undefined && (
            <> · {rand(row.amountCents)}</>
          )}
          {side === "host" &&
            row.hostShareCents !== undefined &&
            (row.status === "paid" || row.status === "completed") && (
              <> · you earn {rand(row.hostShareCents)}</>
            )}
        </p>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${
            STATUS_STYLE[row.status] ?? ""
          }`}
        >
          {STATUS_LABEL[row.status] ?? row.status}
        </span>
      </div>

      <div className="flex gap-2">
        {row.status === "paid" && row.callSessionId && (
          <Link
            href={`/call/${row.callSessionId}`}
            className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold"
          >
            Join call
          </Link>
        )}
        <Link
          href={`/bookings/${row._id}`}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm"
        >
          Details
        </Link>
      </div>
    </li>
  );
}

function Section({
  title,
  rows,
  side,
  empty,
}: {
  title: string;
  rows: Row[];
  side: "guest" | "host";
  empty: string;
}) {
  // Read the clock into state (not during render) and refresh it every minute,
  // so a booking moves from Upcoming to Past while the page is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Upcoming = still to happen (soonest first). Past = everything else (latest first).
  const upcoming = rows
    .filter(
      (r) =>
        r.endsAt > now &&
        (r.status === "paid" || r.status === "pending_payment"),
    )
    .sort((a, b) => a.startsAt - b.startsAt);
  const past = rows
    .filter((r) => !upcoming.includes(r))
    .sort((a, b) => b.startsAt - a.startsAt);

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {rows.length === 0 && <p className="text-sm text-neutral-400">{empty}</p>}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-300">Upcoming</h3>
          <ul className="space-y-2">
            {upcoming.map((r) => (
              <BookingRow key={r._id} row={r} side={side} />
            ))}
          </ul>
        </div>
      )}
      {past.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-300">Past</h3>
          <ul className="space-y-2">
            {past.map((r) => (
              <BookingRow key={r._id} row={r} side={side} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function BookingsPage() {
  const data = useQuery(api.bookings.listMine);

  if (data === undefined) return <p className="p-8">Loading…</p>;
  if (data === null) return <p className="p-8">Please sign in.</p>;

  return (
    <main className="mx-auto max-w-2xl space-y-10 p-6">
      <h1 className="text-3xl font-bold">My bookings</h1>

      {data.isHost && (
        <Section
          title="Bookings with me"
          rows={data.asHost}
          side="host"
          empty="No one has booked you yet."
        />
      )}

      <Section
        title={data.isHost ? "Calls I booked" : "My calls"}
        rows={data.asGuest}
        side="guest"
        empty="You haven't booked a call yet."
      />

      <Link href="/hosts" className="inline-block underline">
        Browse hosts
      </Link>
    </main>
  );
}
