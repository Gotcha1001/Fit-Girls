"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { GIFT_CATALOG } from "@/lib/gifts";
import { ChevronRight, Loader2 } from "lucide-react";
import type { Doc, Id } from "@/convex/_generated/dataModel";

function gift(giftId: string) {
  return GIFT_CATALOG.find((g) => g.id === giftId);
}

function GiftRow({
  transaction,
  otherUserId,
  label,
}: {
  transaction: Doc<"giftTransactions">;
  // The person on the other end: the sender for received gifts,
  // the recipient for sent gifts.
  otherUserId: Id<"users">;
  label: string;
}): React.JSX.Element {
  const definition = gift(transaction.giftId);

  return (
    <Link
      href={`/profile/${otherUserId}`}
      className="group flex items-center gap-3 rounded-xl border p-3 transition accent-card"
    >
      <span className="text-2xl">{definition?.emoji ?? "🎁"}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{definition?.name ?? transaction.giftId}</p>
        {transaction.message && (
          <p className="truncate text-xs text-gray-400">
            &ldquo;{transaction.message}&rdquo;
          </p>
        )}
        <p className="text-xs text-gray-400">
          {new Date(transaction.createdAt).toLocaleDateString()}
        </p>
      </div>
      <span className="flex items-center gap-1 rounded-full border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-600 group-hover:bg-rose-600 group-hover:text-white">
        {label}
        <ChevronRight size={14} />
      </span>
    </Link>
  );
}

export default function GiftsPage(): React.JSX.Element {
  const received = useQuery(api.gifts.getGiftsReceived, {});
  const sent = useQuery(api.gifts.getGiftsSent, {});

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <h1 className="text-2xl font-semibold">Gifts</h1>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Received</h2>
        {received === undefined ? (
          <Loader2 className="animate-spin text-gray-400" />
        ) : received.length === 0 ? (
          <p className="text-sm text-gray-400">No gifts yet.</p>
        ) : (
          <div className="space-y-2">
            {received.map((t) => (
              <GiftRow
                key={t._id}
                transaction={t}
                otherUserId={t.fromUserId}
                label="From"
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Sent</h2>
        {sent === undefined ? (
          <Loader2 className="animate-spin text-gray-400" />
        ) : sent.length === 0 ? (
          <p className="text-sm text-gray-400">
            You haven&apos;t sent any gifts yet.
          </p>
        ) : (
          <div className="space-y-2">
            {sent.map((t) => (
              <GiftRow
                key={t._id}
                transaction={t}
                otherUserId={t.toUserId}
                label="To"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
