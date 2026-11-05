"use client";

// "Check payment status" — asks Razorpay (through our server) whether a
// pending payment actually went through, and unlocks it if it did.
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CheckPaymentButton({
  purchaseId,
  className = "btn-primary",
  label = "Check payment status",
}: {
  purchaseId: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function check() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/payments/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseId }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not check right now.");
      setMsg({ ok: body.status === "paid", text: body.message });
      if (body.status === "paid") router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={check} disabled={busy} className={`${className} disabled:cursor-wait disabled:opacity-70`}>
        {busy ? "Checking with Razorpay…" : label}
      </button>
      {msg && (
        <p role="status" className={`mt-2 text-xs font-semibold ${msg.ok ? "text-emerald-700" : "text-slate-600"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
