"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { LogoutIcon, ReceiptIcon } from "../Icons";
import { useLogout } from "@/lib/useLogout";
import { Spinner } from "../BuyButton";

export function LogoutButton({ className = "" }: { className?: string }) {
  const { logout, loggingOut } = useLogout();
  return (
    <button type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut} className={`btn-light !text-red-600 disabled:cursor-wait disabled:opacity-70 ${className}`}>
      {loggingOut ? <><Spinner /> Logging out…</> : <><LogoutIcon className="h-4 w-4" /> Logout</>}
    </button>
  );
}

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Cancel this booking? See our Refund & Cancellation Policy for refund rules.")) return;
        setBusy(true);
        const { error } = (await getBrowserSupabase()?.from("bookings").update({ status: "cancelled" }).eq("id", bookingId)) ?? {};
        setBusy(false);
        if (error) return alert(error.message);
        router.refresh();
      }}
      className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
    >
      {busy ? "Cancelling…" : "Cancel booking"}
    </button>
  );
}

// Placeholder until real invoices are added
/** Opens the printable invoice (dates in IST) */
export function InvoiceButton({ purchaseId, invoiceNumber }: { purchaseId: string; invoiceNumber: string | null }) {
  return (
    <span className="inline-flex flex-wrap justify-end gap-1.5">
      <Link href={`/invoice/${purchaseId}`} className="btn-light !px-3 !py-1.5 text-xs" title={invoiceNumber ?? undefined}>
        <ReceiptIcon className="h-4 w-4" /> Invoice
      </Link>
      <a href={`/api/invoices/${purchaseId}`} download className="btn-light !px-3 !py-1.5 text-xs" title="Download PDF">PDF</a>
    </span>
  );
}
