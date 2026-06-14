import type { PortfolioPosition } from "@/lib/supabase/database.types";

// ================== TYPES ==================

export interface PortfolioAllocationProps {
  holdings: PortfolioPosition[];
  className?: string;
  isOwner?: boolean;
  // Optional: use cached sector data from parent (avoids duplicate fetches)
  cachedSectorMap?: Map<string, string>;
}

export interface PositionInfo {
  symbol: string;
  displaySymbol: string; // For options: underlying symbol; for stocks: same as symbol
  securityName?: string;
  value: number;
  invested: number;
  gain: number;
  gainPercent: number;
  isOption: boolean;
  optionType?: "call" | "put";
  positionDirection?: "long" | "short";
  units: number;
  price: number;
}

export interface AggregatedPosition {
  displaySymbol: string;
  securityName?: string;
  value: number;
  invested: number;
  gain: number;
  gainPercent: number;
  subPositions: PositionInfo[];
  hasOptions: boolean;
  hasEquity: boolean;
}

export interface SectorData {
  name: string;
  value: number;
  invested: number;
  gain: number;
  gainPercent: number;
  count: number;
  color: string;
  positions: AggregatedPosition[];
}

export type SortKey = "value" | "gain" | "allocation";
export type SortDirection = "asc" | "desc";

export interface SectorTableProps {
  sectorData: SectorData[];
  totalValue: number;
  isOwner: boolean;
  sortKey: SortKey;
  sortDir: SortDirection;
  onSort: (key: SortKey) => void;
  hoveredSector: string | null;
  setHoveredSector: (sector: string | null) => void;
  expandedSectors: Set<string>;
  toggleSector: (sectorName: string) => void;
}

export interface DonutChartProps {
  sectorData: SectorData[];
  totalValue: number;
  hoveredSector: string | null;
  setHoveredSector: (sector: string | null) => void;
  toggleSector: (sectorName: string) => void;
}

export interface SectorLegendProps {
  sectorData: SectorData[];
  totalValue: number;
  hoveredSector: string | null;
  setHoveredSector: (sector: string | null) => void;
  expandedSectors: Set<string>;
  toggleSector: (sectorName: string) => void;
}

