import { usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";

export function SidebarDebug() {
  const pathname = usePathname();
  const locale = useLocale();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-3 rounded-lg text-xs font-mono z-[9999]">
      <div>Locale: {locale}</div>
      <div>Pathname: {pathname}</div>
      <div>Full URL: {typeof window !== 'undefined' ? window.location.pathname : 'N/A'}</div>
    </div>
  );
} 