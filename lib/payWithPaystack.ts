export async function payWithPaystack(packageId: string): Promise<void> {
  const res = await fetch("/api/paystack/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageId }),
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !data.url) {
    throw new Error(
      data.error ?? "Could not start the payment. Please try again.",
    );
  }
  window.location.href = data.url;
}
