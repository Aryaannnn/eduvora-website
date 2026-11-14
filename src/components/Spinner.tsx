/** Small loading circle used on buttons ("Saving…", "Logging out…"). */
export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]" aria-hidden />;
}
