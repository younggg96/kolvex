import { redirect } from "next/navigation";

// Merged into the Trades page; keeps ?symbol=&entry=&stop=&target= from older links.
export default function MovedPlansPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  const qs = query.toString();
  redirect(`/dashboard/trade-os/trades${qs ? `?${qs}` : ""}`);
}
