"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { Loader2 } from "lucide-react";

interface SearchItem {
  id: string;
  [key: string]: any;
}

interface SearchWithAutocompleteProps<T extends SearchItem> {
  placeholder?: string;
  items?: T[];
  popularItems?: T[];
  onSelect: (item: T) => void;
  filterFunction?: (items: T[], searchTerm: string) => T[];
  asyncSearchFunction?: (searchTerm: string) => Promise<T[]>;
  asyncPopularFunction?: () => Promise<T[]>;
  renderItem: (item: T, onSelect: (item: T) => void) => ReactNode;
  popularLabel?: string;
  maxResults?: number;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  debounceMs?: number;
  showPopularOnFocus?: boolean; // 是否在聚焦时显示热门结果
}

const EMPTY_ARRAY: never[] = [];

export default function SearchWithAutocomplete<T extends SearchItem>({
  placeholder = "Search...",
  items,
  popularItems,
  onSelect,
  filterFunction,
  asyncSearchFunction,
  asyncPopularFunction,
  renderItem,
  popularLabel = "POPULAR",
  maxResults = 10,
  className = "",
  inputClassName = "",
  dropdownClassName = "",
  debounceMs = 300,
  showPopularOnFocus = true,
}: SearchWithAutocompleteProps<T>) {
  // 使用稳定的引用
  const stableItems = items ?? (EMPTY_ARRAY as T[]);
  const stablePopularItems = popularItems ?? (EMPTY_ARRAY as T[]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<T[]>([]);
  const [popularResults, setPopularResults] = useState<T[]>(stablePopularItems);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [popularLoaded, setPopularLoaded] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const asyncPopularFunctionRef = useRef(asyncPopularFunction);

  // 保存 filterFunction 和 items 的引用，避免重新触发 useEffect
  const filterFunctionRef = useRef(filterFunction);
  const itemsRef = useRef(stableItems);

  useEffect(() => {
    filterFunctionRef.current = filterFunction;
    itemsRef.current = stableItems;
  }, [filterFunction, stableItems]);

  // 更新 ref
  useEffect(() => {
    asyncPopularFunctionRef.current = asyncPopularFunction;
  }, [asyncPopularFunction]);

  // 加载热门结果（只加载一次）
  useEffect(() => {
    if (popularLoaded) return;
    if (asyncPopularFunctionRef.current) {
      setPopularLoaded(true);
      asyncPopularFunctionRef.current().then((results) => {
        setPopularResults(results);
      });
    }
  }, [popularLoaded]);

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

  // 保存 asyncSearchFunction 的引用
  const asyncSearchFunctionRef = useRef(asyncSearchFunction);
  useEffect(() => {
    asyncSearchFunctionRef.current = asyncSearchFunction;
  }, [asyncSearchFunction]);

  // 搜索逻辑（带防抖）
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchTerm) {
      setSearchResults([]);
      setIsLoading(false);
      // 如果不显示热门结果，关闭下拉框
      if (!showPopularOnFocus) {
        setShowDropdown(false);
      }
      return;
    }

    // 有搜索词时显示下拉框
    setShowDropdown(true);

    const performSearch = async () => {
      if (asyncSearchFunctionRef.current) {
        try {
          const results = await asyncSearchFunctionRef.current(searchTerm);
          setSearchResults(results.slice(0, maxResults));
        } catch (error) {
          console.error("Search error:", error);
          setSearchResults([]);
        }
      } else if (filterFunctionRef.current) {
        const filtered = filterFunctionRef.current(
          itemsRef.current,
          searchTerm
        );
        setSearchResults(filtered.slice(0, maxResults));
      }
      setIsLoading(false);
    };

    if (asyncSearchFunctionRef.current) {
      setIsLoading(true);
      debounceRef.current = setTimeout(performSearch, debounceMs);
    } else {
      performSearch();
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, maxResults, debounceMs, showPopularOnFocus]);

  // 显示的列表：搜索结果或热门推荐
  const displayList = searchTerm
    ? searchResults
    : showPopularOnFocus
    ? (popularResults.length > 0 ? popularResults : stablePopularItems).slice(
        0,
        maxResults
      )
    : [];

  const handleSelectItem = (item: T) => {
    onSelect(item);
    setSearchTerm("");
    setShowDropdown(false);
  };

  const handleInputClick = () => {
    // 如果不显示热门结果，只在有搜索词时显示下拉框
    if (!showPopularOnFocus) {
      if (searchTerm) {
        setShowDropdown(true);
      }
      return;
    }

    // 显示下拉框（只有在有数据或可以加载时）
    if (
      popularResults.length > 0 ||
      stablePopularItems.length > 0 ||
      asyncPopularFunctionRef.current
    ) {
      setShowDropdown(true);
    }
    // 如果还没有加载热门结果，触发加载
    if (!popularLoaded && asyncPopularFunctionRef.current) {
      setPopularLoaded(true);
      asyncPopularFunctionRef.current().then((results) => {
        setPopularResults(results);
      });
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
        className={cn("h-9", inputClassName)}
      />

      {/* Dropdown Results */}
      {showDropdown && (displayList.length > 0 || isLoading) && (
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
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Searching...</span>
            </div>
          ) : displayList.length > 0 ? (
            displayList.map((item) => (
              <div
                key={item.id}
                className="hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors duration-200"
              >
                {renderItem(item, handleSelectItem)}
              </div>
            ))
          ) : searchTerm ? (
            <div className="px-3 py-4 text-sm text-gray-500 dark:text-white/50 text-center">
              No results found for &quot;{searchTerm}&quot;
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
