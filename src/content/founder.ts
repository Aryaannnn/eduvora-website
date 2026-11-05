// =====================================================================
//  ✏️ FOUNDER TEXT — edit this file to change the founder section
//  (home page), the About page and the full story page (/founder).
//  The photo is public/founder.jpg — replace that file to change it.
// =====================================================================

export const founder = {
  name: "Utkarsh Shrivastava",
  title: "Founder & CEO, Eduvora | Student Mentor | Education Counsellor",
  shortTitle: "Founder & CEO, EDUVORA", // used where space is small
  photo: "/founder.jpg",
  photoAlt: "Utkarsh Shrivastava, Founder of EDUVORA",

  // 2–3 lines for the home page and About page
  summary:
    "A third-year Mechanical Engineering student at VIT Vellore and the Founder of Eduvora, Utkarsh has spent over 2 years guiding 1,000+ students through VITEEE and other competitive exams — helping them understand admissions, explore opportunities and make the right academic choices.",

  // Highlight cards (icon: "students" | "years" | "college")
  highlights: [
    { icon: "students", label: "1,000+ Students Guided" },
    { icon: "years", label: "2+ Years of Counselling" },
    { icon: "college", label: "VIT Vellore, Mechanical Engineering" },
  ],

  // ---------- Full story (/founder) — one item per paragraph ----------
  story: [
    "Utkarsh Shrivastava is a third-year Mechanical Engineering student at VIT Vellore and the Founder of Eduvora, an emerging educational platform built with one powerful vision: to make the journey of every aspiring student smarter, simpler, and more successful.",
    "With over 2 years of experience in student counselling and academic guidance, Utkarsh has successfully guided 1,000+ students in navigating their educational journeys, preparing for competitive examinations, and making informed career decisions. His expertise primarily focuses on VITEEE and other competitive entrance examinations, where he helps students understand admission processes, explore opportunities, and make the right academic choices.",
    "What started as a passion for helping fellow students has evolved into a mission to create something bigger. Through Eduvora, he aims to bring together reliable counselling, quality study materials, exam-oriented resources, and practical guidance under one platform.",
    "As a student himself, he understands the challenges, confusion, and pressure that aspirants experience during their preparation journey. This firsthand understanding drives his commitment to building an education ecosystem that prioritises accessibility, transparency, and student success.",
  ],

  // The vision line — shown as a gold highlighted quote
  visionIntro: "His vision is simple yet ambitious:",
  vision: "Not just to help students get into colleges, but to help them make the right decisions that shape their future.",

  // Final line of the story
  closing: "Eduvora is not just a platform; it's a mission to turn confusion into clarity and aspirations into achievements.",
} as const;

export type FounderHighlightIcon = (typeof founder.highlights)[number]["icon"];
