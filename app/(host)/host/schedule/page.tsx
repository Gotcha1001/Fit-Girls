"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  MAX_DAYS_AHEAD,
  formatDayLong,
  relativeDayLabel,
} from "@/convex/lib/schedule";
import { useZonedClock } from "@/hooks/useZonedClock";
import { useViewerTz } from "@/hooks/useViewerTz";
import { Button } from "@/components/ui/button";
import { HostDayGrid } from "@/app/components/HostDayGrid";

export default function HostSchedulePage() {
  // For a host, her profile zone IS her schedule zone (setLocale keeps them in sync).
  const hostTz = useViewerTz();
  const { timeLabel, dayIndex: today, label } = useZonedClock(hostTz);
  const maxDay = today + MAX_DAYS_AHEAD;

  // null = "follow today", so the view stays right past her midnight.
  const [picked, setPicked] = useState<number | null>(null);
  const dayIndex =
    picked === null ? today : Math.min(Math.max(picked, today), maxDay);

  const [error, setError] = useState<string | null>(null);

  const day = useQuery(api.calendar.getMyDay, { dayIndex });
  const setOverride = useMutation(api.calendar.setDayOverride);
  const clearOverride = useMutation(api.calendar.clearDayOverride);

  function jump(delta: number) {
    setPicked(Math.min(Math.max(dayIndex + delta, today), maxDay));
  }

  async function toggleHour(hour: number) {
    if (!day) return;
    setError(null);
    const next = new Set(day.hours);
    if (next.has(hour)) next.delete(hour);
    else next.add(hour);
    try {
      await setOverride({
        dayIndex,
        hours: [...next].sort((a, b) => a - b),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  }

  async function reset() {
    setError(null);
    try {
      await clearOverride({ dayIndex });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reset");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-16">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-white">Schedule</h1>
          <Link
            href="/host/schedule/weekly"
            className="text-sm text-pink-300 underline"
          >
            Weekly hours →
          </Link>
        </div>
        <p className="text-sm text-zinc-300">
          All times in your time zone:{" "}
          <span className="font-semibold">{label}</span> · now{" "}
          <span className="font-mono font-semibold">{timeLabel}</span>
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={dayIndex <= today}
          onClick={() => jump(-1)}
        >
          ←
        </Button>
        <Button
          size="sm"
          variant={dayIndex === today ? "default" : "outline"}
          onClick={() => setPicked(null)}
        >
          Today
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={dayIndex >= maxDay}
          onClick={() => jump(1)}
        >
          →
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={dayIndex >= maxDay}
          onClick={() => jump(7)}
        >
          +7 days
        </Button>
        <span className="ml-auto text-sm text-zinc-300">
          {relativeDayLabel(dayIndex, today)} · {formatDayLong(dayIndex)}
        </span>
      </div>

      {day?.isOverride && (
        <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          <span>This day has a custom override.</span>
          <Button size="sm" variant="outline" onClick={reset}>
            Reset to weekly hours
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <HostDayGrid day={day} onToggleHour={toggleHour} />

      <p className="text-xs text-zinc-500">
        Tap an open or off slot to change it for this day only (saves as an
        override). Tap a booked call to open that booking in a new tab and join
        the call. Each booking also shows the client&apos;s local time. Edit
        your usual weekly hours under Schedule → Weekly hours.
      </p>
    </div>
  );
}
