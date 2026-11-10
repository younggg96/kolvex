import CongressTradesPage from "@/components/congress/CongressTradesPage";

export const metadata = {
  title: "Congress trades · Kolvex",
  robots: { index: false, follow: false },
};

export default function Page({ searchParams }: { searchParams?: { ticker?: string | string[] } }) {
  const ticker = typeof searchParams?.ticker === "string" && /^[A-Za-z0-9.^=-]{1,20}$/.test(searchParams.ticker)
    ? searchParams.ticker.toUpperCase()
    : "";
  return <CongressTradesPage key={ticker} initialTicker={ticker} />;
}
