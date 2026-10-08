"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  dayStartMs,
  formatDayLong,
  formatHour,
  relativeDayLabel,
  MAX_DAYS_AHEAD,
} from "@/convex/lib/schedule";
import { ALL_HOURS } from "@/convex/lib/slots";
import { useSastClock } from "@/hooks/useSastClock";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  open: "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer",
  booked: "bg-zinc-700 text-zinc-400 cursor-not-allowed",
  mine: "bg-sky-600 text-white cursor-default",
  off: "bg-zinc-900 text-zinc-600 cursor-not-allowed",
};

type Props = {
  hostId: Id<"hosts">;
  onSelectSlot: (startsAt: number) => void;
};

export function GirlCalendar({ hostId, onSelectSlot }: Props) {
  const { dayIndex: today } = useSastClock(15_000);
  const [dayIndex, setDayIndex] = useState(today);

  // Keep selection from falling into the past when SAST midnight rolls over.
  // Adjust state while rendering (React-approved), not inside an effect.
  const maxDay = today + MAX_DAYS_AHEAD;
  if (dayIndex < today) {
    setDayIndex(today);
  } else if (dayIndex > maxDay) {
    setDayIndex(maxDay);
  }

  const day = useQuery(api.calendar.getDay, { hostId, dayIndex });

  function jump(delta: number) {
    const next = dayIndex + delta;
    if (next < today || next > maxDay) return;
    setDayIndex(next);
  }

  function handleClick(hour: number, state: string) {
    if (state !== "open") return;
    onSelectSlot(dayStartMs(dayIndex) + hour * 3_600_000);
  }

  return (
    <div className="space-y-4">
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
          onClick={() => setDayIndex(today)}
        >
          Today
        </Button>
        <Button
          size="sm"
          variant={dayIndex === today + 1 ? "default" : "outline"}
          onClick={() => setDayIndex(today + 1)}
        >
          Tomorrow
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={dayIndex >= maxDay}
          onClick={() => jump(1)}
        >
          →
        </Button>
        <Button size="sm" variant="outline" onClick={() => jump(7)}>
          +7 days
        </Button>
        <span className="ml-auto text-sm text-zinc-300">
          {relativeDayLabel(dayIndex, today)} · {formatDayLong(dayIndex)}
        </span>
      </div>

      {day === undefined && (
        <p className="text-sm text-zinc-500">Loading availability…</p>
      )}
      {day === null && (
        <p className="text-sm text-zinc-500">No availability for this day.</p>
      )}

      {day && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {ALL_HOURS.map((h) => {
            const state = day.states[h];
            return (
              <button
                key={h}
                type="button"
                disabled={state !== "open"}
                onClick={() => handleClick(h, state)}
                className={cn(
                  "rounded-lg px-2 py-3 text-center text-sm font-medium transition",
                  COLORS[state],
                )}
              >
                {formatHour(h)}
                <div className="mt-0.5 text-[10px] capitalize opacity-70">
                  {state === "open" ? "Available" : state}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-600" />
          Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
          Your booking
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-800" />
          Off / closed
        </span>
      </div>
    </div>
  );
}
