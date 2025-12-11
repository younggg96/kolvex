interface NewsItem {
  time: string;
  title: string;
  description: string;
  isHighlighted?: boolean;
}

const newsItems: NewsItem[] = [
  {
    time: "10:32 AM",
    title: "Market Hits Record Highs as Fed Signals Dovish Stance",
    description:
      "Investors cheer as the Federal Reserve indicates potential rate cuts later this year, sending major indices soaring.",
    isHighlighted: true,
  },
  {
    time: "10:28 AM",
    title: "Tech Giant 'Innovate Inc.' Unveils New AI Chip",
    description:
      "Innovate Inc. (INV) shares jump 8% pre-market after announcing a groundbreaking AI processor.",
  },
  {
    time: "10:15 AM",
    title: "Oil Prices Dip on Unexpected Inventory Build",
    description:
      "Energy stocks feel the pressure as crude oil inventories rise, signaling weaker demand.",
  },
  {
    time: "09:55 AM",
    title: "SEC Approves New Round of Bitcoin ETFs",
    description:
      "Cryptocurrency-related stocks are on the rise following regulatory approval for new spot Bitcoin ETFs.",
  },
  {
    time: "09:45 AM",
    title: "Retail Sales Data Comes in Weaker Than Expected",
    description:
      "Consumer discretionary stocks underperform after latest retail sales figures suggest a slowdown in spending.",
  },
  {
    time: "09:30 AM",
    title: "Opening Bell: Stocks Mixed as Traders Digest Inflation Report",
    description:
      "The market opens with uncertainty as the latest CPI data shows inflation remains persistent.",
  },
  {
    time: "09:10 AM",
    title: "'AutoDrive Corp' stock falls after recalling 500,000 vehicles",
    description:
      "Safety concerns lead to a major recall, causing a sharp decline in AutoDrive Corp (ADC) shares.",
  },
  {
    time: "08:50 AM",
    title: "Global Markets React to European Central Bank Rate Decision",
    description:
      "The ECB holds rates steady, but signals a hawkish tone, creating ripples across international indices.",
  },
];

export default function MarketNews() {
  return (
    <>
      {newsItems.map((item, index) => (
        <div key={index}>
          <div className="flex items-start gap-3 py-3">
            <div className="text-gray-500 dark:text-white/50 text-xs min-w-[60px]">
              {item.time}
            </div>
            <div className="flex-1">
              <div
                className={`${
                  item.isHighlighted
                    ? "border-l-2 border-primary"
                    : "border-l-2 border-gray-300 dark:border-border-dark"
                } pl-3`}
              >
                <a
                  className="text-gray-900 dark:text-white font-semibold text-sm hover:text-primary transition-colors cursor-pointer"
                  href="#"
                >
                  {item.title}
                </a>
                <p className="text-xs text-gray-600 dark:text-white/60 mt-1">
                  {item.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
