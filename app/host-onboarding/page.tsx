"use client";

import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type Bank = { name: string; code: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

const field =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-700";
const button =
  "rounded-md bg-emerald-800 px-5 py-2.5 font-medium text-white hover:bg-emerald-900 " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 disabled:opacity-50";

export default function HostOnboarding() {
  const host = useQuery(api.hosts.getMyHost);
  const saveProfile = useMutation(api.hosts.saveProfile);
  const listBanks = useAction(api.hostPayout.listBanks);
  const setupPayout = useAction(api.hostPayout.setupPayout);

  const [banks, setBanks] = useState<Bank[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [rateRand, setRateRand] = useState("10");
  const [over18, setOver18] = useState(false);

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [namesMatch, setNamesMatch] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  // Load the form with any saved profile
  useEffect(() => {
    if (host) {
      setDisplayName(host.displayName);
      setBio(host.bio);
      setRateRand(String(host.ratePerMinuteCents / 100));
    }
  }, [host?._id]);

  // Load banks once a profile exists
  useEffect(() => {
    if (host && !host.payoutReady && banks.length === 0) {
      listBanks()
        .then(setBanks)
        .catch((e: unknown) => setError(errorMessage(e)));
    }
  }, [host?._id, host?.payoutReady]);

  if (host === undefined) return <p className="p-8">Loading…</p>;

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await saveProfile({
        displayName,
        bio,
        ratePerMinuteCents: Math.round(parseFloat(rateRand) * 100),
      });
      setDone("Profile saved.");
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSavePayout(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await setupPayout({ bankCode, accountNumber, accountHolder });
      setAccountNumber(""); // don't keep it in memory
      setDone("Payouts are set up.");
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-10 px-4 py-10 text-stone-900">
      <header>
        <h1 className="text-2xl font-semibold">Set up your host profile</h1>
        <p className="mt-2 text-stone-600">
          You keep 80% of every booking and unlock. The platform takes 20%.
          Payouts go straight to your bank account.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {done && (
        <p
          role="status"
          className="rounded-md bg-emerald-50 p-3 text-emerald-900"
        >
          {done}
        </p>
      )}

      <form onSubmit={onSaveProfile} className="space-y-4">
        <h2 className="text-lg font-semibold">Your profile</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Display name</span>
          <input
            className={field}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Bio</span>
          <textarea
            className={field}
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={500}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Your rate (rand per minute)
          </span>
          <input
            className={field}
            type="number"
            min="5"
            max="100"
            step="0.5"
            value={rateRand}
            onChange={(e) => setRateRand(e.target.value)}
            required
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={over18}
            onChange={(e) => setOver18(e.target.checked)}
            className="mt-1"
          />
          <span>
            I am 18 or older and I accept the host terms. I understand I must
            pass an ID check before I can take bookings.
          </span>
        </label>
        <button className={button} disabled={busy || !over18}>
          Save profile
        </button>
      </form>

      {host && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Where we pay you</h2>
          {host.payoutReady ? (
            <p className="rounded-md bg-stone-100 p-3">
              Payouts go to the account ending in{" "}
              <strong>{host.bankLast4}</strong>. To change it, contact support.
            </p>
          ) : (
            <form onSubmit={onSavePayout} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Bank</span>
                <select
                  className={field}
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  required
                >
                  <option value="">Choose your bank</option>
                  {banks.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">
                  Account holder name
                </span>
                <input
                  className={field}
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">
                  Account number
                </span>
                <input
                  className={field}
                  inputMode="numeric"
                  pattern="[0-9 ]{6,20}"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={namesMatch}
                  onChange={(e) => setNamesMatch(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  This account is in my own name, and the name matches my ID.
                </span>
              </label>
              <button className={button} disabled={busy || !namesMatch}>
                Save bank details
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
