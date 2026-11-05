import { LockIcon, MailIcon, ReceiptIcon, ShieldIcon, ZapIcon } from "../Icons";
import Reveal from "../Reveal";

const methods = ["UPI", "Visa", "Mastercard", "RuPay", "Net Banking", "Wallets"];
const points = [
  { icon: ZapIcon, title: "Instant confirmation", text: "Your booking or order is confirmed right after payment." },
  { icon: MailIcon, title: "Invoice on email", text: "Your payment receipt and invoice are emailed to you." },
  { icon: ShieldIcon, title: "Bank-grade security", text: "Encrypted payments — we never see or store your card details." },
  { icon: ReceiptIcon, title: "Clear refund policy", text: "Simple, fair rules for cancellations and refunds." },
];

export default function TrustSection() {
  return (
    <section className="section bg-slate-50">
      <div className="container-page">
        <Reveal className="overflow-hidden rounded-[2rem] bg-white shadow-xl shadow-slate-200/60 ring-1 ring-slate-200">
          <div className="grid lg:grid-cols-[1fr_1.2fr]">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 text-white sm:p-10">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15"><LockIcon className="h-7 w-7" /></span>
              <h2 className="mt-5 text-2xl font-extrabold sm:text-3xl">100% Secure Payments via Razorpay</h2>
              <p className="mt-3 text-emerald-50">Pay the way you like. Every transaction is protected and processed by Razorpay, India&apos;s trusted payment gateway.</p>
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Accepted payment methods">
                {methods.map((m) => (
                  <li key={m} className="rounded-lg bg-white px-3 py-1.5 text-xs font-extrabold tracking-wide text-slate-800 shadow-sm">{m}</li>
                ))}
              </ul>
            </div>
            <div className="grid gap-6 p-8 sm:grid-cols-2 sm:p-10">
              {points.map((p) => (
                <div key={p.title}>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><p.icon className="h-5 w-5" /></span>
                  <p className="mt-3 font-bold text-slate-900">{p.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
