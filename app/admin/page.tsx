"use client";

import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export default function AdminPage(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const isAdmin = useQuery(api.admin.amIAdmin, isAuthenticated ? {} : "skip");
  // Only ask for the pending list once we know she's an admin.
  // The server enforces this too (requireAdmin); this is just to avoid error noise.
  const pending = useQuery(api.admin.listPendingHosts, isAdmin ? {} : "skip");
  const approveHost = useMutation(api.admin.approveHost);
  const suspendHost = useMutation(api.admin.suspendHost);

  const [idChecked, setIdChecked] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  if (isLoading || (isAuthenticated && isAdmin === undefined)) {
    return <p className="p-6 text-sm opacity-70">Loading…</p>;
  }
  if (!isAuthenticated) {
    return <p className="p-6 text-sm">Please sign in.</p>;
  }
  if (!isAdmin) {
    return (
      <p className="p-6 text-sm">You don&apos;t have access to this page.</p>
    );
  }

  async function onApprove(hostId: Id<"hosts">): Promise<void> {
    setBusyId(hostId);
    try {
      await approveHost({ hostId, idChecked: !!idChecked[hostId] });
      toast.success("Host approved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setBusyId(null);
    }
  }

  async function onSuspend(hostId: Id<"hosts">): Promise<void> {
    setBusyId(hostId);
    try {
      await suspendHost({ hostId });
      toast.success("Host suspended");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not suspend");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-bold">Admin: pending hosts</h1>

      {pending === undefined && <p className="text-sm opacity-70">Loading…</p>}
      {pending?.length === 0 && (
        <p className="text-sm opacity-70">No hosts waiting for review.</p>
      )}

      {pending?.map((h) => (
        <div key={h._id} className="rounded-xl border p-4 space-y-3">
          <div className="flex items-start gap-3">
            {h.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={h.avatarUrl}
                alt={h.displayName}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xs">
                No photo
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{h.displayName}</p>
              <p className="truncate text-xs opacity-70">{h.email}</p>
              <p className="mt-1 text-sm">{h.bio || "No bio"}</p>
              <p className="mt-1 text-xs opacity-70">
                Rate: R{(h.ratePerMinuteCents / 100).toFixed(2)}/min
              </p>
              <p className="text-xs">
                Bank:{" "}
                {h.payoutReady
                  ? `set up (ending ${h.bankLast4 ?? "????"})`
                  : "NOT set up yet"}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!idChecked[h._id]}
              onChange={(e) =>
                setIdChecked((s) => ({ ...s, [h._id]: e.target.checked }))
              }
            />
            I have checked her ID and confirmed she is 18 or older
          </label>

          <div className="flex gap-2">
            <button
              onClick={() => onApprove(h._id)}
              disabled={busyId === h._id || !idChecked[h._id] || !h.payoutReady}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Approve
            </button>
            <button
              onClick={() => onSuspend(h._id)}
              disabled={busyId === h._id}
              className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
            >
              Suspend
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
