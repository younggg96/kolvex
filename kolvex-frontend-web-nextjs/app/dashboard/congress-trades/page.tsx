import CongressTradesPage from "@/components/congress/CongressTradesPage";

export const metadata = {
  title: "Congress trades · Kolvex",
  robots: { index: false, follow: false },
};

export default function Page({
  searchParams,
}: {
  searchParams?: { ticker?: string | string[]; member?: string | string[] };
}) {
  const ticker =
    typeof searchParams?.ticker === "string" && /^[A-Za-z0-9.^=-]{1,20}$/.test(searchParams.ticker)
      ? searchParams.ticker.toUpperCase()
      : "";
  const member =
    typeof searchParams?.member === "string" ? searchParams.member.trim().slice(0, 100) : "";
  return (
    <CongressTradesPage key={`${ticker}|${member}`} initialTicker={ticker} initialMember={member} />
  );
}
