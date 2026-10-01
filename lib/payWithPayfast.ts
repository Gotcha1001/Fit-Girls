// lib/payWithPayfast.ts
//
// Client-side helper. Asks our server for the signed PayFast fields, then
// submits them to PayFast as a real form POST (PayFast doesn't accept fetch).
// The fields are posted EXACTLY as the server returned them: do not re-order,
// trim or re-encode anything here, the signature depends on it.

interface CheckoutResponse {
  actionUrl?: string;
  fields?: Record<string, string | number>;
  error?: string;
}

export async function payWithPayfast(packageId: string): Promise<void> {
  const res = await fetch("/api/payfast/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packageId }),
  });

  const data = (await res.json().catch(() => null)) as CheckoutResponse | null;

  if (!res.ok || !data?.actionUrl || !data.fields) {
    throw new Error(
      data?.error ?? "Could not start the payment. Please try again.",
    );
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = data.actionUrl;

  for (const [key, value] of Object.entries(data.fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = String(value);
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
