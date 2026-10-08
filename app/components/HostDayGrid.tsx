"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import {
  HOUR_MS,
  dayStartMs,
  formatHour,
  formatTimeRange,
} from "@/convex/lib/schedule";
import { ALL_HOURS } from "@/convex/lib/slots";
import { cn } from "@/lib/utils";
import { HourBar, type BarSegment } from "./HourBar";

type Day = NonNullable<FunctionReturnType<typeof api.calendar.getMyDay>>;
type DayBooking = Day["bookings"][number];

const SLOT_COLORS: Record<string, string> = {
  open: "bg-emerald-500/20 border-emerald-500/40 text-emerald-100",
  booked: "bg-rose-500/25 border-rose-500/50 text-rose-100",
  mine: "bg-sky-500/25 border-sky-500/50 text-sky-100",
  off: "bg-zinc-800/50 border-zinc-700 text-zinc-500",
};

const BOOKING_LABEL: Record<string, string> = {
  paid: "Paid · open to start call",
  pending_payment: "Awaiting payment",
  completed: "Completed",
};

/**
 * The host's day: one card per hour. An hour can now hold several short calls,
 * so each card lists every booking inside it (soonest first) and links to it.
 * Tap the hour label to open/close that hour when it has no bookings.
 */
export function HostDayGrid({
  day,
  onToggleHour,
}: {
  day: Day | null | undefined;
  onToggleHour: (hour: number) => void;
}) {
  const byHour = useMemo(() => {
    const map = new Map<number, DayBooking[]>();
    if (!day) return map;
    const start = dayStartMs(day.dayIndex);
    const sorted = [...day.bookings].sort((a, b) => a.startsAt - b.startsAt);
    for (const b of sorted) {
      for (const h of ALL_HOURS) {
        const slotStart = start + h * HOUR_MS;
        if (b.startsAt < slotStart + HOUR_MS && b.endsAt > slotStart) {
          const list = map.get(h) ?? [];
          list.push(b);
          map.set(h, list);
        }
      }
    }
    return map;
  }, [day]);

  const segments: BarSegment[] = useMemo(
    () =>
      (day?.bookings ?? []).map((b) => ({
        startsAt: b.startsAt,
        endsAt: b.endsAt,
        tone: "booked" as const,
      })),
    [day],
  );

  const dayStart = day ? dayStartMs(day.dayIndex) : 0;

  return (
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
      {ALL_HOURS.map((h) => {
        const state = day?.states[h] ?? "off";
        const list = byHour.get(h) ?? [];
        const hasBookings = list.length > 0;

        return (
          <div
            key={h}
            className={cn(
              "rounded-xl border p-3",
              hasBookings ? SLOT_COLORS.booked : SLOT_COLORS[state],
            )}
          >
            <button
              type="button"
              disabled={hasBookings}
              onClick={() => onToggleHour(h)}
              className="flex w-full items-center justify-between text-left disabled:cursor-default"
            >
              <span className="font-mono text-sm font-semibold">
                {formatHour(h)}
              </span>
              <span className="text-xs capitalize opacity-80">
                {hasBookings
                  ? `${list.length} call${list.length === 1 ? "" : "s"}`
                  : state}
              </span>
            </button>

            <HourBar
              hourStart={dayStart + h * HOUR_MS}
              segments={segments}
              closed={state === "off" && !hasBookings}
              showScale={hasBookings}
            />

            {hasBookings && (
              <ul className="mt-2 space-y-1">
                {list.map((b) => (
                  <li key={b._id}>
                    <Link
                      href={`/bookings/${b._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-md bg-black/20 px-2 py-1.5 text-xs transition hover:ring-1 hover:ring-white/30"
                    >
                      <span className="font-mono font-semibold">
                        {formatTimeRange(b.startsAt, b.endsAt)}
                      </span>
                      <span className="ml-1 opacity-90">
                        · {b.guestName} · {b.minutes}m
                      </span>
                      <span className="block opacity-70">
                        {BOOKING_LABEL[b.status] ?? b.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
