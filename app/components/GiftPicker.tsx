"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface GiftPickerProps {
  toUserId: Id<"users">; // the host's users._id (not hosts._id)
  onSent?: () => void;
}

export function GiftPicker({
  toUserId,
  onSent,
}: GiftPickerProps): React.JSX.Element {
  const catalog = useQuery(api.gifts.listGiftCatalog);
  const summary = useQuery(api.tokens.getMySummary);
  const sendGift = useMutation(api.gifts.sendGift);

  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sentLabel, setSentLabel] = useState<string | null>(null);

  // Cheapest first so the grid reads left to right in a sensible order.
  const gifts = useMemo(
    () => (catalog ? [...catalog].sort((a, b) => a.coinCost - b.coinCost) : []),
    [catalog],
  );

  const selected = gifts.find((g) => g.id === selectedGiftId);
  const balance = summary?.balance ?? 0;
  const cantAfford = Boolean(selected && balance < selected.coinCost);

  async function handleSend(): Promise<void> {
    if (!selectedGiftId || cantAfford) return;
    setIsSending(true);
    setError(null);
    setSentLabel(null);
    try {
      await sendGift({
        toUserId,
        giftId: selectedGiftId,
        message: note.trim() || undefined,
      });
      setSentLabel(
        selected ? `${selected.emoji} ${selected.name} sent!` : "Gift sent!",
      );
      setSelectedGiftId(null);
      setNote("");
      onSent?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send gift");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold md:text-2xl">
            Enjoyed the call? Send a gift
          </h2>
          <p className="mt-1 text-sm text-neutral-400">
            Gifts are paid with tokens. She sees your name and email on her
            Gifts page.
          </p>
        </div>
        <Link
          href="/tokens"
          className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-200 transition hover:border-pink-500/60"
        >
          <span className="text-neutral-400">Balance</span>
          <span className="font-semibold text-white">
            {summary ? `${balance} tokens` : "…"}
          </span>
        </Link>
      </div>

      {/* Gift tiles */}
      <div
        role="radiogroup"
        aria-label="Choose a gift"
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4"
      >
        {gifts.map((gift) => {
          const isSelected = selectedGiftId === gift.id;
          return (
            <button
              key={gift.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => {
                setSelectedGiftId(gift.id);
                setSentLabel(null);
                setError(null);
              }}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-5 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 md:py-7 ${
                isSelected
                  ? "border-pink-500 bg-pink-500/10 ring-1 ring-pink-500"
                  : "border-white/10 bg-neutral-900/60 hover:border-pink-500/50 hover:bg-white/5"
              }`}
            >
              <span className="text-5xl leading-none md:text-6xl" aria-hidden>
                {gift.emoji}
              </span>
              <span className="mt-1 text-sm font-medium text-white">
                {gift.name}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isSelected
                    ? "bg-pink-600 text-white"
                    : "bg-white/10 text-neutral-300"
                }`}
              >
                {gift.coinCost} tokens
              </span>
            </button>
          );
        })}
      </div>

      {/* Note + send */}
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          disabled={!selected}
          placeholder={
            selected ? "Add a note (optional)" : "Pick a gift to add a note"
          }
          className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm placeholder:text-neutral-500 focus:border-pink-500 focus:outline-none disabled:opacity-50 md:flex-1"
        />

        {cantAfford ? (
          <Link
            href="/tokens"
            className="block w-full rounded-full border border-pink-500 px-6 py-3 text-center text-sm font-semibold text-pink-400 transition hover:bg-pink-600 hover:text-white md:w-auto md:min-w-72"
          >
            Not enough tokens, buy more
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!selected || isSending}
            className="w-full rounded-full bg-pink-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:min-w-72"
          >
            {isSending
              ? "Sending..."
              : selected
                ? `Send ${selected.name} for ${selected.coinCost} tokens`
                : "Select a gift"}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {sentLabel && <p className="mt-3 text-sm text-green-400">{sentLabel}</p>}
    </section>
  );
}
