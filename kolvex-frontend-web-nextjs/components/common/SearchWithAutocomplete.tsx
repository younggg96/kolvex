"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";

interface SearchItem {
  id: string;
  [key: string]: any;
}

interface SearchWithAutocompleteProps<T extends SearchItem> {
  placeholder?: string;
  items: T[];
  popularItems?: T[];
  onSelect: (item: T) => void;
  filterFunction: (items: T[], searchTerm: string) => T[];
  renderItem: (item: T, onSelect: (item: T) => void) => ReactNode;
  popularLabel?: string;
  maxResults?: number;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
}

export default function SearchWithAutocomplete<T extends SearchItem>({
  placeholder = "Search...",
  items,
  popularItems = [],
  onSelect,
  filterFunction,
  renderItem,
  popularLabel = "POPULAR",
  maxResults = 10,
  className = "",
  inputClassName = "",
  dropdownClassName = "",
}: SearchWithAutocompleteProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<T[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 搜索逻辑
  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const filtered = filterFunction(items, searchTerm);
    setSearchResults(filtered.slice(0, maxResults));
    setShowDropdown(true);
  }, [searchTerm, items, filterFunction, maxResults]);

  // 显示的列表：搜索结果或热门推荐
  const displayList = searchTerm
    ? searchResults
    : popularItems.slice(0, maxResults);

  const handleSelectItem = (item: T) => {
    onSelect(item);
    setSearchTerm("");
    setShowDropdown(false);
  };

  const handleInputClick = () => {
    // 只有在有内容或有热门推荐时才显示下拉框
    if (searchTerm || popularItems.length > 0) {
      setShowDropdown(true);
    }
  };

  return (
    <div ref={searchRef} className={cn("relative", className)}>
      <SearchInput
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onClick={handleInputClick}
        containerClassName="flex-none w-full"
        iconClassName="z-10"
        className={cn(
          "h-9 bg-white dark:bg-card-dark border-gray-200 dark:border-white/10 text-sm",
          inputClassName
        )}
      />

      {/* Dropdown Results */}
      {showDropdown && displayList.length > 0 && (
        <div
          className={cn(
            "absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card-dark border border-gray-200 dark:border-white/10 rounded-lg shadow-lg max-h-[300px] overflow-y-auto z-50",
            dropdownClassName
          )}
        >
          {!searchTerm && popularLabel && (
            <div className="px-3 py-2 text-[10px] font-medium text-gray-500 dark:text-white/50 border-b border-gray-100 dark:border-white/5">
              {popularLabel}
            </div>
          )}
          {displayList.map((item) => (
            <div key={item.id}>{renderItem(item, handleSelectItem)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
