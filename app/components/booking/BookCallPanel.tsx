"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  MIN_MS,
  dayIndexOf,
  dayShiftLabel,
  durationOptions,
  formatDayLong,
  formatTimeRange,
  tzLabel,
} from "@/convex/lib/schedule";
import { useViewerTz } from "@/hooks/useViewerTz";
import { Button } from "@/components/ui/button";
import { GirlCalendar } from "./GirlCalendar";

export function BookCallPanel({
  hostId,
  hostTz,
  minMinutes,
  ratePerMinuteCents,
}: {
  hostId: Id<"hosts">;
  hostTz: string;
  minMinutes: number;
  ratePerMinuteCents: number;
}) {
  const viewerTz = useViewerTz();
  const [minutes, setMinutes] = useState(minMinutes);
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = useMutation(api.bookings.createBooking);
  const initCheckout = useAction(api.payments.initCheckout);

  const options = durationOptions(minMinutes, 120);

  function chooseMinutes(m: number) {
    setMinutes(m);
    setStartsAt(null); // start times change with the length, so drop the old pick
    setError(null);
  }

  async function confirm() {
    if (startsAt == null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const bookingId = await createBooking({ hostId, startsAt, minutes });
      // Ask Paystack for a payment link, then send the client there
      const url = await initCheckout({ bookingId });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  const endsAt = startsAt == null ? 0 : startsAt + minutes * MIN_MS;
  const sameZone = viewerTz === hostTz;
  const shift =
    startsAt == null || sameZone
      ? ""
      : dayShiftLabel(startsAt, hostTz, viewerTz);

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm text-zinc-400">Duration</p>
        <div className="flex flex-wrap gap-2">
          {options.map((m) => (
            <Button
              key={m}
              size="sm"
              variant={minutes === m ? "default" : "outline"}
              onClick={() => chooseMinutes(m)}
            >
              {m} min · R{((ratePerMinuteCents * m) / 100).toFixed(0)}
            </Button>
          ))}
        </div>
      </div>

      <GirlCalendar
        hostId={hostId}
        hostTz={hostTz}
        minutes={minutes}
        selected={startsAt}
        onSelectSlot={setStartsAt}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {startsAt != null && (
        <div className="space-y-2">
          <div className="space-y-1 text-sm text-zinc-300">
            <p>
              <span className="text-zinc-500">Her time: </span>
              {formatDayLong(dayIndexOf(startsAt, hostTz))} ·{" "}
              {formatTimeRange(startsAt, endsAt, hostTz)}{" "}
              <span className="text-xs text-zinc-500">
                ({tzLabel(hostTz, startsAt)})
              </span>
            </p>
            {!sameZone && (
              <p>
                <span className="text-zinc-500">Your time: </span>
                {formatDayLong(dayIndexOf(startsAt, viewerTz))} ·{" "}
                {formatTimeRange(startsAt, endsAt, viewerTz)}{" "}
                <span className="text-xs text-zinc-500">
                  ({tzLabel(viewerTz, startsAt)})
                </span>
                {shift && (
                  <span className="ml-1 rounded bg-amber-500/20 px-1 text-xs text-amber-300">
                    {shift}
                  </span>
                )}
              </p>
            )}
          </div>
          <Button className="w-full" onClick={confirm} disabled={busy}>
            {busy ? "Redirecting to payment…" : "Continue to payment"}
          </Button>
        </div>
      )}
    </div>
  );
}
