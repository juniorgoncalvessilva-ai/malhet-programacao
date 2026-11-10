import { memo } from 'react';
import { cn } from "@/lib/utils";
import { ChevronUp } from "../icons";
import { MenuItem } from "../menu-item";
import { NavigationItem } from "../types";
import { useInternationalizedRoutes } from "../hooks/useInternationalizedRoutes";

interface SidebarItemProps {
  item: NavigationItem;
  currentPath: string;
  expandedItems: string[];
  onToggleExpanded: (title: string) => void;
}

export const SidebarItem = memo(function SidebarItem({
  item,
  currentPath,
  expandedItems,
  onToggleExpanded,
}: SidebarItemProps) {
  const { getLocalizedRoute, isRouteActive } = useInternationalizedRoutes();

  const isExpanded = expandedItems.includes(item.title);
  const hasSubItems = item.items.length > 0;

  // Check if any subitem is active
  const isParentActive = hasSubItems && item.items.some(
    ({ url }) => isRouteActive(currentPath, url)
  );

  if (hasSubItems) {
    return (
      <div>
        <MenuItem
          isActive={isParentActive}
          onClick={() => onToggleExpanded(item.title)}
        >
          <item.icon
            className="size-6 shrink-0"
            aria-hidden="true"
          />
          <span>{item.title}</span>
          <ChevronUp
            className={cn(
              "ml-auto rotate-180 transition-transform duration-200",
              isExpanded && "rotate-0",
            )}
            aria-hidden="true"
          />
        </MenuItem>

        {isExpanded && (
          <ul
            className="ml-9 mr-0 space-y-1.5 pb-[15px] pr-0 pt-2"
            role="menu"
            aria-label={`${item.title} submenu`}
          >
            {item.items.map((subItem) => {
              const localizedUrl = getLocalizedRoute(subItem.url);
              const isSubItemActive = isRouteActive(currentPath, subItem.url);

              return (
                <li key={subItem.title} role="none">
                  <MenuItem
                    as="link"
                    href={localizedUrl}
                    isActive={isSubItemActive}
                  >
                    <span>{subItem.title}</span>
                  </MenuItem>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // Single item without subitems
  const itemUrl = item.url || `/${item.title.toLowerCase().replace(/\s+/g, '-')}`;
  const localizedUrl = getLocalizedRoute(itemUrl);
  const isItemActive = isRouteActive(currentPath, itemUrl);

  return (
    <MenuItem
      className="flex items-center gap-3 py-3"
      as="link"
      href={localizedUrl}
      isActive={isItemActive}
    >
      <item.icon
        className="size-6 shrink-0"
        aria-hidden="true"
      />
      <span>{item.title}</span>
    </MenuItem>
  );
}); 