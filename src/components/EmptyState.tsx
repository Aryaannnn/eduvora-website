import { isSupabaseConfigured } from "@/lib/supabase/env";

// Shown when a list has no items (or Supabase isn't connected yet)
export default function EmptyState({ what = "items" }: { what?: string }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
      <p className="font-bold text-slate-800">No {what} to show yet.</p>
      <p className="mt-1 text-sm text-slate-500">
        {isSupabaseConfigured
          ? "New ones will appear here soon. Check back shortly!"
          : "Supabase isn't connected yet — add your keys to .env.local (see SUPABASE_SETUP.md)."}
      </p>
    </div>
  );
}
