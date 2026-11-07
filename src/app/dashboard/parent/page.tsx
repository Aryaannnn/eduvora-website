import type { Metadata } from "next";
import { Suspense } from "react";
import ParentShare from "@/components/dashboard/ParentShare";
import { DashSkeleton, PageHeader } from "@/components/dashboard/ui";
import { displayName, requireUser } from "@/lib/dashboard";
import { getMyParentShare } from "@/lib/parent-share";

export const metadata: Metadata = { title: "Share with Parent" };

export default function ParentSharePage() {
  return (
    <Suspense fallback={<DashSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const s = await requireUser("/dashboard/parent");
  const share = await getMyParentShare(s);
  return (
    <>
      <PageHeader title="Share with Parent" subtitle="Give your parent a private, read-only view of your progress — no login needed." />
      <ParentShare share={share} studentFirst={displayName(s).split(" ")[0]} />
    </>
  );
}
