import Link from "next/link";

type Props = {
  host: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
    ratePerMinuteCents: number;
    minMinutes: number;
  };
};

export function HostCard({ host }: Props) {
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
        <h3 className="font-semibold">{host.displayName}</h3>
        <p className="text-sm text-neutral-400">
          R{(host.ratePerMinuteCents / 100).toFixed(2)}/min · min{" "}
          {host.minMinutes} min
        </p>
      </div>
    </Link>
  );
}
