"use client";

import Link from "next/link";
import { formatTime } from "@/convex/lib/schedule";
import { useNow } from "@/hooks/useNow";

type Props = {
  host: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
    ratePerMinuteCents: number;
    minMinutes: number;
    country?: string | null;
    timezone?: string | null;
  };
};

/** "ZA" -> 🇿🇦 (regional-indicator letters). */
function flagOf(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function HostCard({ host }: Props) {
  const now = useNow(60_000);
  return (
    <Link
      href={`/hosts/${host._id}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-pink-500/60"
    >
      <div className="aspect-[3/4] bg-neutral-800">
        {host.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={host.avatarUrl}
            alt={host.displayName}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold">
          {host.country && (
            <span className="mr-1.5" title={host.country}>
              {flagOf(host.country)}
            </span>
          )}
          {host.displayName}
        </h3>
        <p className="text-sm text-neutral-400">
          R{(host.ratePerMinuteCents / 100).toFixed(2)}/min · min{" "}
          {host.minMinutes} min
        </p>
        {host.timezone && (
          <p className="mt-0.5 text-xs text-neutral-500">
            Her time {formatTime(now, host.timezone)}
          </p>
        )}
      </div>
    </Link>
  );
}
