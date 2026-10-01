"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface GiftPickerProps {
  toUserId: Id<"users">;
  onSent?: () => void;
}

export function GiftPicker({
  toUserId,
  onSent,
}: GiftPickerProps): React.JSX.Element {
  const catalog = useQuery(api.gifts.listGiftCatalog);
  const myProfile = useQuery(api.profiles.getMyProfile);
  const sendGift = useMutation(api.gifts.sendGift);

  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sentLabel, setSentLabel] = useState<string | null>(null);

  async function handleSend(): Promise<void> {
    if (!selectedGiftId) return;
    setIsSending(true);
    setError(null);
    try {
      await sendGift({
        toUserId,
        giftId: selectedGiftId,
        message: note.trim() || undefined,
      });
      const gift = catalog?.find((g) => g.id === selectedGiftId);
      setSentLabel(gift ? `${gift.emoji} ${gift.name} sent!` : "Gift sent!");
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
    <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Send a gift</p>
        <p className="text-xs text-gray-400">
          Balance: {myProfile?.coins ?? "—"} coins
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {catalog?.map((gift) => (
          <button
            key={gift.id}
            type="button"
            onClick={() => setSelectedGiftId(gift.id)}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center ${
              selectedGiftId === gift.id
                ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30"
                : "border-gray-200 dark:border-gray-800"
            }`}
          >
            <span className="text-2xl">{gift.emoji}</span>
            <span className="text-[10px] text-gray-500">
              {gift.coinCost} coins
            </span>
          </button>
        ))}
      </div>

      {selectedGiftId && (
        <div className="mt-3 space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="w-full rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send gift"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      {sentLabel && <p className="mt-2 text-xs text-green-600">{sentLabel}</p>}
    </div>
  );
}
