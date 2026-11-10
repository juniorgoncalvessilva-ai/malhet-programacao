import { useState, useCallback, useEffect, useMemo } from 'react';
import { NavigationData } from '../types';

export function useExpandedItems(pathname: string, navigationData: NavigationData, locale?: string) {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = useCallback((title: string) => {
    setExpandedItems((prev) => {
      const isExpanded = prev.includes(title);
      return isExpanded ? [] : [title];
    });
  }, []);

  // Memoize the navigation lookup to avoid recalculating on every render
  const itemToExpandFromPath = useMemo(() => {
    let itemToExpand = '';

    navigationData.some((section) => {
      return section.items.some((item) => {
        if (item.items && item.items.length > 0) {
          return item.items.some((subItem) => {
            if (subItem.url === pathname) {
              itemToExpand = item.title;
              return true;
            }
            return false;
          });
        }
        return false;
      });
    });

    return itemToExpand;
  }, [pathname, navigationData]);

  // Auto-expand item when its subpage is active
  // Also consider locale changes to re-evaluate expanded items
  useEffect(() => {
    if (itemToExpandFromPath) {
      setExpandedItems((prev) => {
        if (!prev.includes(itemToExpandFromPath)) {
          return [itemToExpandFromPath];
        }
        return prev;
      });
    }
  }, [itemToExpandFromPath, locale]);

  // Reset expanded items when locale changes to prevent stale state
  useEffect(() => {
    setExpandedItems([]);
  }, [locale]);

  return {
    expandedItems,
    toggleExpanded,
  };
} 