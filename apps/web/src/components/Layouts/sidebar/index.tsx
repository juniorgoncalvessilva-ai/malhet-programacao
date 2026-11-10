"use client";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/hooks/useNavigation";
import { useLocale, useTranslations } from 'next-intl';
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useMemo } from "react";
import { PanelLeftIcon, PanelRightIcon } from "lucide-react";
import { useExpandedItems } from "./hooks/useExpandedItems";
import { SidebarItem } from "./components/SidebarItem";
import { SidebarDebug } from "./debug";
import { Tooltip } from "@/components/ui/tooltip";
import { 
  useSidebarOpen, 
  useSidebarCollapsed, 
  useIsMobile, 
  useUIActions 
} from "@/store";

export function Sidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const NAV_DATA = useNavigation();
  const t = useTranslations('Accessibility');
  
  // Use Zustand UI Store instead of React Context
  const isOpen = useSidebarOpen();
  const isCollapsed = useSidebarCollapsed();
  const isMobile = useIsMobile();
  const { toggleSidebar, toggleSidebarCollapsed, setSidebarOpen } = useUIActions();
  
  const { expandedItems, toggleExpanded } = useExpandedItems(pathname, NAV_DATA, locale);

  // Memoize the overlay click handler to prevent unnecessary re-renders
  const handleOverlayClick = useMemo(() => (e: React.MouseEvent) => {
    e.stopPropagation();
    setSidebarOpen(false);
  }, [setSidebarOpen]);

  // Memoize the mobile toggle handler
  const handleMobileToggle = useMemo(() => () => {
    if (isMobile) toggleSidebar();
  }, [isMobile, toggleSidebar]);

  // Determine the effective width based on mobile/desktop and collapsed state
  const sidebarWidth = useMemo(() => {
    if (isMobile) {
      return isOpen ? "w-full" : "w-0";
    }
    // Desktop behavior
    return isCollapsed ? "w-16" : "w-[290px]";
  }, [isMobile, isOpen, isCollapsed]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "border-r border-gray-200 bg-white transition-[width] duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-dark",
          isMobile ? "fixed bottom-0 top-0 z-50 max-w-[290px]" : "sticky top-0 h-screen",
          sidebarWidth,
        )}
        aria-label="Main navigation"
        aria-hidden={isMobile && !isOpen}
        lang={locale}
      >
        <div className="flex h-full flex-col py-10 pl-[25px] pr-[7px] overflow-hidden">
          {/* Header */}
          <div className="relative pr-4.5">
            <Link
              href="/"
              onClick={handleMobileToggle}
              className={cn(
                "px-0 py-2.5 min-[850px]:py-0 transition-opacity duration-200",
                !isMobile && isCollapsed && "opacity-0 pointer-events-none"
              )}
            >
              <Logo />
            </Link>

            {/* Mobile close button */}
            {isMobile && (
              <button
                onClick={toggleSidebar}
                className="absolute left-3/4 right-4.5 top-1/2 -translate-y-1/2 text-right"
                aria-label={t('closeSidebar')}
              >
                <span className="sr-only">{t('closeMenu')}</span>
                <PanelLeftIcon className="ml-auto size-7" />
              </button>
            )}

            {/* Desktop collapse button */}
            {!isMobile && (
              <button
                onClick={toggleSidebarCollapsed}
                className={cn(
                  "absolute -right-1 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200 hover:shadow-lg border-none",
                  isCollapsed && "left-1 -translate-x-1/2"
                )}
                aria-label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
                title={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
              >
                {isCollapsed ? (
                  <PanelRightIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <PanelLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav 
            className={cn(
              "custom-scrollbar mt-6 flex-1 overflow-y-auto pr-3 transition-opacity duration-200",
              !isMobile && isCollapsed && "opacity-0 hidden pointer-events-none"
            )}
          >
            {NAV_DATA.map((section) => (
              <section key={section.label} className="mb-6">
                <h2 className="mb-5 text-sm font-medium text-dark-4 dark:text-dark-6">
                  {section.label}
                </h2>

                <ul className="space-y-2" role="menu" aria-label={section.label}>
                  {section.items.map((item) => (
                    <li key={item.title} role="none">
                      <SidebarItem
                        item={item}
                        currentPath={pathname}
                        expandedItems={expandedItems}
                        onToggleExpanded={toggleExpanded}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>

          {/* Collapsed state indicators for desktop */}
          {!isMobile && isCollapsed && (
            <div className="flex flex-col items-center space-y-3 pr-3 mt-6">
              {NAV_DATA.map((section) => (
                section.items.map((item) => (
                  <Tooltip
                    key={item.title}
                    content={item.title}
                    placement="right"
                    variant="default"
                  >
                    <Link
                      href={item.url || `/${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-dark-4 transition-colors hover:bg-gray-100 hover:text-dark dark:text-dark-6 dark:hover:bg-[#FFFFFF1A] dark:hover:text-white"
                      title={item.title}
                    >
                      <item.icon className="h-5 w-5" />
                    </Link>
                  </Tooltip>
                ))
              ))}
            </div>
          )}
        </div>
      </aside>
      
      {/* Debug component - only shows in development */}
      <SidebarDebug />
    </>
  );
}
