// sp500-export.mjs
// Node 18+ required (for global fetch).
// Usage: node sp500-export.mjs [outFile]
// Default outFile: sp500.constituents.json
//
// Source CSV: https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv
// Fields: Symbol,Security,GICS Sector,GICS Sub-Industry,Headquarters Location,Date added,CIK,Founded
//
// This script outputs a minimal JSON array:
// [ { "symbol": "...", "name": "...", "sector": "...", "subIndustry": "...", "headquarters": "...", "dateAdded": "...", "cik": "...", "founded": "..." }, ... ]

const CSV_URL = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv";

const outFile = process.argv[2] || "sp500.constituents.json";

function csvParseLine(line) {
  // Basic CSV parser for lines, supports quoted fields with commas.
  // Not bulletproof, but sufficient for the known source.
  const result = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // toggle quotes or handle escaped quotes
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  result.push(field);
  return result;
}

function csvToObjects(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = csvParseLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = csvParseLine(lines[i]);
    if (!cols || cols.length < header.length) continue;
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = typeof cols[j] === "string" ? cols[j].trim() : cols[j];
    }
    rows.push(obj);
  }
  return rows;
}

function normalize(rows) {
  return rows.map(r => ({
    symbol: r["Symbol"],
    name: r["Security"],
    sector: r["GICS Sector"],
    subIndustry: r["GICS Sub-Industry"],
    headquarters: r["Headquarters Location"],
    dateAdded: r["Date added"],
    cik: r["CIK"],
    founded: r["Founded"]
  }));
}

const fs = await import("node:fs");

(async () => {
  try {
    console.log("Fetching CSV from:", CSV_URL);
    const res = await fetch(CSV_URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching CSV`);
    }
    const csvText = await res.text();
    const rows = csvToObjects(csvText);
    const data = normalize(rows);
    fs.writeFileSync(outFile, JSON.stringify(data, null, 2), "utf-8");
    console.log(`✅ Wrote ${data.length} records to ${outFile}`);
  } catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
  }
})();
