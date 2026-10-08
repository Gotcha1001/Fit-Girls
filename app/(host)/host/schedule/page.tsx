"use client";

import { useMemo, useState } from "react";
import Link from "next/link"; // NEW
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  dayStartMs, // NEW
  formatDayLong,
  formatHour,
  formatTime,
  relativeDayLabel,
  HOUR_MS, // NEW
  MAX_DAYS_AHEAD,
} from "@/convex/lib/schedule";
import { ALL_HOURS } from "@/convex/lib/slots";
import { useSastClock } from "@/hooks/useSastClock";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SLOT_COLORS: Record<string, string> = {
  open: "bg-emerald-500/20 border-emerald-500/40 text-emerald-100",
  booked: "bg-rose-500/25 border-rose-500/50 text-rose-100",
  mine: "bg-sky-500/25 border-sky-500/50 text-sky-100",
  off: "bg-zinc-800/50 border-zinc-700 text-zinc-500",
};

// NEW: what to show on a booked slot, by booking status
const BOOKING_LABEL: Record<string, string> = {
  paid: "Paid · open to start call",
  pending_payment: "Awaiting payment",
  completed: "Completed",
};

export default function HostSchedulePage() {
  const { timeLabel, dayIndex: today, tz } = useSastClock();
  const [dayIndex, setDayIndex] = useState(today);

  const maxDay = today + MAX_DAYS_AHEAD;
  if (dayIndex < today) {
    setDayIndex(today);
  } else if (dayIndex > maxDay) {
    setDayIndex(maxDay);
  }

  const day = useQuery(api.calendar.getMyDay, { dayIndex });
  const setOverride = useMutation(api.calendar.setDayOverride);
  const clearOverride = useMutation(api.calendar.clearDayOverride);

  // CHANGED: map a booking to EVERY hour it covers, not just the start hour
  const bookingsByHour = useMemo(() => {
    const map = new Map<number, NonNullable<typeof day>["bookings"][number]>();
    if (!day) return map;
    const start = dayStartMs(day.dayIndex);
    for (const b of day.bookings) {
      for (const h of ALL_HOURS) {
        const slotStart = start + h * HOUR_MS;
        if (b.startsAt < slotStart + HOUR_MS && b.endsAt > slotStart) {
          map.set(h, b);
        }
      }
    }
    return map;
  }, [day]);

  function jump(delta: number) {
    setDayIndex((d) => {
      const next = d + delta;
      if (next < today) return today;
      if (next > maxDay) return maxDay;
      return next;
    });
  }

  async function toggleHour(hour: number) {
    if (!day) return;
    const next = new Set(day.hours);
    if (next.has(hour)) next.delete(hour);
    else next.add(hour);
    await setOverride({
      dayIndex,
      hours: [...next].sort((a, b) => a - b),
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-16">
      {/* ...live clock, day flip buttons and clear-override button stay exactly as they are... */}

      {/* Hourly grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {ALL_HOURS.map((h) => {
          const state = day?.states[h] ?? "off";
          const booking = bookingsByHour.get(h);

          // NEW: booked slot = link to that booking, in a new tab
          if (booking) {
            const startsHere =
              booking.startsAt >= dayStartMs(dayIndex) + h * HOUR_MS &&
              booking.startsAt < dayStartMs(dayIndex) + (h + 1) * HOUR_MS;
            return (
              <Link
                key={h}
                href={`/bookings/${booking._id}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "block rounded-xl border p-3 text-left transition hover:ring-2 hover:ring-white/30",
                  SLOT_COLORS.booked,
                )}
              >
                <div className="font-mono text-sm font-semibold">
                  {formatHour(h)}
                </div>
                <div className="mt-1 text-xs opacity-80">
                  {BOOKING_LABEL[booking.status] ?? booking.status}
                </div>
                <div className="mt-1 truncate text-xs opacity-90">
                  {startsHere
                    ? `${booking.guestName} · ${booking.minutes}m · ${formatTime(booking.startsAt)}`
                    : `${booking.guestName} (continues)`}
                </div>
              </Link>
            );
          }

          // unchanged: open / off slots still toggle
          return (
            <button
              key={h}
              type="button"
              onClick={() => toggleHour(h)}
              className={cn(
                "rounded-xl border p-3 text-left transition hover:ring-2 hover:ring-white/15",
                SLOT_COLORS[state],
              )}
            >
              <div className="font-mono text-sm font-semibold">
                {formatHour(h)}
              </div>
              <div className="mt-1 text-xs capitalize opacity-80">{state}</div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-zinc-500">
        Tap an open or off slot to change it for this day only (saves as an
        override). Tap a booked slot to open that booking in a new tab and join
        the call. Edit your usual weekly hours under Schedule → Weekly hours.
      </p>
    </div>
  );
}
