import { toast } from "sonner";
import type { SnapTradeHoldings } from "../types";

interface ExportPosition {
  account_name: string;
  brokerage_name: string;
  symbol: string;
  security_name: string;
  position_type: string;
  units: number;
  price: number;
  market_value: number;
  average_purchase_price: number | null;
  open_pnl: number;
  weight_percent: number;
  currency: string;
  // Option specific fields
  option_type?: string;
  strike_price?: number;
  expiration_date?: string;
  underlying_symbol?: string;
}

export function downloadHoldings(
  holdings: SnapTradeHoldings,
  format: "csv" | "json"
) {
  if (!holdings?.accounts) {
    toast.error("No holdings data to download");
    return;
  }

  // Collect all positions from all accounts
  const allPositions: ExportPosition[] = [];

  holdings.accounts.forEach((account) => {
    account.snaptrade_positions?.forEach((pos) => {
      const units = typeof pos.units === "number" ? pos.units : 0;
      const price = typeof pos.price === "number" ? pos.price : 0;
      const multiplier = pos.position_type === "option" ? 100 : 1;
      const marketValue = price * units * multiplier;

      allPositions.push({
        account_name: account.account_name || "",
        brokerage_name: account.brokerage_name || "",
        symbol: pos.symbol || "",
        security_name: pos.security_name || "",
        position_type: pos.position_type || "equity",
        units: units,
        price: price,
        market_value: marketValue,
        average_purchase_price:
          typeof pos.average_purchase_price === "number"
            ? pos.average_purchase_price
            : null,
        open_pnl: typeof pos.open_pnl === "number" ? pos.open_pnl : 0,
        weight_percent:
          typeof pos.weight_percent === "number" ? pos.weight_percent : 0,
        currency: pos.currency || "USD",
        // Option specific fields
        option_type: pos.option_type,
        strike_price:
          typeof pos.strike_price === "number" ? pos.strike_price : undefined,
        expiration_date: pos.expiration_date,
        underlying_symbol: pos.underlying_symbol,
      });
    });
  });

  if (allPositions.length === 0) {
    toast.error("No positions to download");
    return;
  }

  const timestamp = new Date().toISOString().split("T")[0];
  let content: string;
  let mimeType: string;
  let filename: string;

  if (format === "csv") {
    // Generate CSV
    const headers = [
      "Account",
      "Broker",
      "Symbol",
      "Security Name",
      "Type",
      "Units",
      "Price",
      "Market Value",
      "Avg Cost",
      "P&L",
      "Weight %",
      "Currency",
      "Option Type",
      "Strike",
      "Expiration",
      "Underlying",
    ];

    const rows = allPositions.map((pos) => [
      pos.account_name,
      pos.brokerage_name,
      pos.symbol,
      pos.security_name,
      pos.position_type,
      pos.units.toString(),
      pos.price.toFixed(2),
      pos.market_value.toFixed(2),
      pos.average_purchase_price?.toFixed(2) || "",
      pos.open_pnl.toFixed(2),
      pos.weight_percent.toFixed(2),
      pos.currency,
      pos.option_type || "",
      pos.strike_price?.toString() || "",
      pos.expiration_date || "",
      pos.underlying_symbol || "",
    ]);

    // Escape CSV values
    const escapeCSV = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    content = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    mimeType = "text/csv";
    filename = `holdings_${timestamp}.csv`;
  } else {
    // Generate JSON
    const jsonData = {
      exported_at: new Date().toISOString(),
      total_value:
        typeof holdings.total_value === "number" ? holdings.total_value : null,
      accounts_count: holdings.accounts.length,
      positions_count: allPositions.length,
      positions: allPositions,
    };

    content = JSON.stringify(jsonData, null, 2);
    mimeType = "application/json";
    filename = `holdings_${timestamp}.json`;
  }

  // Create and trigger download
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success(
    `Holdings exported as ${format.toUpperCase()} (${allPositions.length} positions)`
  );
}

