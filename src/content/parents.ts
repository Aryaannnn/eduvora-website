// =====================================================================
//  ✏️ "FOR PARENTS" PAGE TEXT (/parents) — edit anything in this file.
//  Keep it simple, honest and calm: no pressure, no fear, no made-up numbers.
//  • The founder's photo, name and story come from src/content/founder.ts
//  • The refund rule comes from src/config/site.ts (refunds) — one rule everywhere
//  • Parent reviews come from Admin → Reviews (type "Parent"); the section is
//    hidden until at least one is approved. Never write reviews here.
// =====================================================================
import { siteConfig } from "@/config/site";

const r = siteConfig.refunds;

export const parentsPage = {
  meta: {
    title: "For Parents — VITEEE & VIT Counselling Guidance",
    description: "A calm, clear guide for parents: what VIT counselling help covers, how a session works, fees, hostel and refund questions, and how payments and data are kept safe.",
  },

  hero: {
    eyebrow: "For parents",
    title: "Helping your child choose the right VIT campus and branch — together",
    subtitle:
      "Counselling decisions are family decisions. You are welcome to join every call, ask anything, and take your time to decide.",
  },

  // Buttons (shown at the top and the bottom of the page)
  buttons: {
    book: "Book a call with parents joining",
    whatsapp: "Ask us on WhatsApp",
    whatsappMessage: "Hi, I'm a parent. I have a few questions about VITEEE counselling for my child.",
    // pre-filled in the booking form's message box
    bookingNote: "My parents will join the call.",
  },

  covers: {
    title: "What counselling covers",
    intro: "One-to-one guidance based on your child's rank, interests and your family's budget.",
    items: [
      { title: "Campus choice", text: "The differences between VIT Vellore, Chennai, AP and Bhopal, and which ones are realistic for the rank." },
      { title: "Branch choice", text: "How branches compare, and how to balance the branch your child wants with the campus you prefer." },
      { title: "Fee categories", text: "How VIT's fee categories work, what they depend on, and how to plan for them. We always point you to VIT's official fee details." },
      { title: "The counselling process", text: "The phases, the important dates and what happens at each step, so nothing comes as a surprise." },
      { title: "Documents", text: "A checklist of the documents usually needed, so you can keep them ready in advance." },
      { title: "Choice list", text: "Help preparing a sensible order of choices before you fill them in." },
    ],
  },

  steps: {
    title: "How a session works",
    items: [
      { title: "Choose a time", text: "Pick a slot on the Book a Slot page. Pay securely online, or use a session from a counselling package." },
      { title: "Get your confirmation", text: "You receive a confirmation email with the date, time and a Google Meet link. Parents can join from the same link." },
      { title: "Keep a few things ready", text: "Your child's expected marks or rank, the campuses and branches you are considering, your budget and your questions." },
      { title: "The call", text: "A private video call. We go through your child's options together and answer every question — from you and from your child." },
      { title: "Your plan", text: "You leave with a clear plan for campus, branch and fee category, and know what to do next in counselling." },
    ],
    note: "Can't make it at the booked time? You can ask to reschedule.",
  },

  faq: {
    title: "Questions parents ask",
    items: [
      {
        q: "How much does counselling cost?",
        a: "The prices of single sessions and counselling packages are shown on the Book a Slot page before you pay. There are no hidden charges, and you get an invoice by email.",
      },
      {
        q: "Will you tell us the college fees?",
        a: "Yes. We explain how VIT's fee categories work and what affects them for your child's rank. Fees are set by VIT and can change, so please always confirm the final amount on VIT's official website.",
      },
      {
        q: "Can you guide us about hostels?",
        a: "Yes. We explain the hostel options and the points families usually consider, based on what VIT publishes. Hostel rooms and fees are decided by VIT, so please confirm the details with VIT directly.",
      },
      {
        q: "Is the campus safe for my child?",
        a: "This is a very important question. We share honest, first-hand information from a current VIT student and point you to VIT's official information on campus life, hostels and student support. We encourage you to ask VIT directly about anything that matters to your family.",
      },
      {
        q: "What if we need to cancel or reschedule?",
        a: `${r.counsellingNote} The full rules are on our Refund & Cancellation Policy page.`,
      },
      {
        q: "Can both parents join the call?",
        a: "Of course. Both parents, and your child, can join the same video call from different phones or laptops.",
      },
      {
        q: "Do you guarantee admission or a particular branch?",
        a: "No — and nobody honestly can. Admission depends on VIT's process and your child's rank. Our job is to help your family understand the options clearly and make an informed choice.",
      },
      {
        q: "Is EDUVORA part of VIT?",
        a: "No. EDUVORA is an independent counselling platform and is not connected to or endorsed by Vellore Institute of Technology (VIT).",
      },
    ],
  },

  counsellor: {
    title: "Meet the counsellor",
    // The photo, name, title and short story come from src/content/founder.ts
    linkText: "Read the full story",
  },

  safety: {
    title: "How we keep your payment and data safe",
    items: [
      { title: "Secure payments", text: "Payments go through Razorpay using UPI, cards or net banking. We never see or store your card or bank details." },
      { title: "Invoice by email", text: "Every payment gets an invoice by email, and you can download it again any time from the dashboard." },
      { title: "Clear refund rules", text: `${r.counsellingNote}` },
      { title: "Your data stays private", text: "We use your details only to provide counselling and support. You can download or delete your data any time from My Profile." },
      { title: "No pressure", text: "Ask your questions first — by WhatsApp or a free enquiry — and book only when your family is ready." },
    ],
  },

  reviews: {
    title: "What parents say",
    subtitle: "Reviews from parents we have guided.",
  },

  closing: {
    title: "Have a question before booking?",
    text: "Send us a message on WhatsApp or book a call when it suits your family. You're welcome to join every session.",
  },
};
