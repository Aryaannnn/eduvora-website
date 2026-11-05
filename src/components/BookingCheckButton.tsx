"use client";

// "Check payment status" for a counselling booking (asks Razorpay via our server).
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postJson } from "@/lib/razorpay-checkout";
import { Spinner } from "./BuyButton";

export default function BookingCheckButton({ bookingId, auto = false }: { bookingId: string; auto?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function check() {
    setBusy(true);
    setMsg("");
    const r = await postJson("/api/bookings/check", { bookingId }, 25000);
    setBusy(false);
    if (r.data.status === "paid") return router.refresh();
    setMsg(String(r.data.message ?? r.data.error ?? "Could not check right now."));
  }

  // Check once automatically when the page opens
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => void check(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <div>
      <button type="button" onClick={check} disabled={busy} className="btn-accent w-full !py-3.5 text-base disabled:opacity-70">
        {busy ? <><Spinner /> Checking with Razorpay…</> : "Check payment status"}
      </button>
      {msg && <p role="status" className="mt-2 text-sm text-slate-600">{msg}</p>}
    </div>
  );
}
