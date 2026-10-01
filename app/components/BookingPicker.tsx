"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  hostId: Id<"hosts">;
  ratePerMinuteCents: number;
  minMinutes: number;
};

export function BookingPicker({
  hostId,
  ratePerMinuteCents,
  minMinutes,
}: Props) {
  const createBooking = useMutation(api.bookings.createBooking);
  const initCheckout = useAction(api.payments.initCheckout);

  const [when, setWhen] = useState("");
  const [minutes, setMinutes] = useState(minMinutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = (ratePerMinuteCents * minutes) / 100;

  async function onPay() {
    setError(null);
    if (!when) return setError("Pick a date and time");
    const startsAt = new Date(when).getTime();
    if (startsAt < Date.now()) return setError("Pick a time in the future");

    setBusy(true);
    try {
      const bookingId = await createBooking({ hostId, startsAt, minutes });
      const url = await initCheckout({ bookingId });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <label className="block text-sm">
        Date & time
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="mt-1 w-full rounded-lg bg-neutral-900 p-2"
        />
      </label>

      <label className="block text-sm">
        Duration
        <select
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="mt-1 w-full rounded-lg bg-neutral-900 p-2"
        >
          {[minMinutes, minMinutes * 2, minMinutes * 3, minMinutes * 4].map(
            (m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ),
          )}
        </select>
      </label>

      <p className="text-lg font-semibold">Total: R{total.toFixed(2)}</p>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={onPay}
        disabled={busy}
        className="w-full rounded-xl bg-pink-600 py-3 font-semibold disabled:opacity-50"
      >
        {busy ? "Redirecting to payment…" : "Book & pay"}
      </button>
    </div>
  );
}
