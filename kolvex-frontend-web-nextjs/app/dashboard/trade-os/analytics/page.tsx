import { redirect } from "next/navigation";

// Merged into the Trades page.
export default function MovedPage() {
  redirect("/dashboard/trade-os/trades");
}
