"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { siteConfig } from "@/config/site";
import { cancelMyBooking } from "@/lib/booking-actions";
import { LogoutIcon, ReceiptIcon } from "../Icons";
import { useLogout } from "@/lib/useLogout";
import { Spinner } from "../Spinner";

export function LogoutButton({ className = "" }: { className?: string }) {
  const { logout, loggingOut } = useLogout();
  return (
    <button type="button" onClick={logout} disabled={loggingOut} aria-busy={loggingOut} className={`btn-light !text-red-600 disabled:cursor-wait disabled:opacity-70 ${className}`}>
      {loggingOut ? <><Spinner /> Logging out…</> : <><LogoutIcon className="h-4 w-4" /> Logout</>}
    </button>
  );
}

/** The confirmation tells the student, from the ONE rule in src/config/site.ts, whether they get a refund. */
export function CancelBookingButton({ bookingId, slotDate, slotTime, paid }: { bookingId: string; slotDate: string; slotTime: string; paid: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        const h = siteConfig.refunds.counsellingHours;
        const hoursLeft = (new Date(`${slotDate}T${slotTime.slice(0, 8)}+05:30`).getTime() - Date.now()) / 3_600_000;
        const refund = !paid
          ? ""
          : hoursLeft >= h
            ? `\n\nYour slot is more than ${h} hours away, so you get a FULL REFUND (within ${siteConfig.refunds.processingTime}).`
            : `\n\nYour slot is less than ${h} hours away, so there is NO REFUND. (Free reschedule or full refund is only up to ${h} hours before.)`;
        if (!confirm(`Cancel this booking?${refund}\n\nTip: to change the time instead, message us on WhatsApp.`)) return;
        setBusy(true);
        const res = await cancelMyBooking(bookingId); // server: cancels + removes the Google Calendar event
        setBusy(false);
        if (!res.ok) return alert(res.error);
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
