"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { durationOptions } from "@/convex/lib/schedule";
import { Button } from "@/components/ui/button";
import { GirlCalendar } from "./booking/GirlCalendar";

export function BookCallPanel({
  hostId,
  minMinutes,
  ratePerMinuteCents,
}: {
  hostId: Id<"hosts">;
  minMinutes: number;
  ratePerMinuteCents: number;
}) {
  const [minutes, setMinutes] = useState(minMinutes);
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = useMutation(api.bookings.createBooking);
  const initCheckout = useAction(api.payments.initCheckout); // NEW

  const options = durationOptions(minMinutes, 120);

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
              onClick={() => setMinutes(m)}
            >
              {m} min · R{((ratePerMinuteCents * m) / 100).toFixed(0)}
            </Button>
          ))}
        </div>
      </div>

      <GirlCalendar hostId={hostId} onSelectSlot={setStartsAt} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {startsAt != null && (
        <Button className="w-full" onClick={confirm} disabled={busy}>
          {busy ? "Redirecting to payment…" : "Continue to payment"}
        </Button>
      )}
    </div>
  );
}
