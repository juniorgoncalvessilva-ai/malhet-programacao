import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";
import { Link } from "@/i18n/navigation";
import { MenuItemUnionProps } from "./types";
import { useIsMobile, useUIActions } from "@/store";

const menuItemBaseStyles = cva(
  "rounded-lg px-3.5 font-medium text-dark-4 transition-all duration-200 dark:text-dark-6",
  {
    variants: {
      isActive: {
        true: "bg-[rgba(87,80,241,0.07)] text-primary hover:bg-[rgba(87,80,241,0.07)] dark:bg-[#FFFFFF1A] dark:text-white",
        false:
          "hover:bg-gray-100 hover:text-dark hover:dark:bg-[#FFFFFF1A] hover:dark:text-white",
      },
    },
    defaultVariants: {
      isActive: false,
    },
  },
);

export function MenuItem(props: MenuItemUnionProps) {
  const isMobile = useIsMobile();
  const { toggleSidebar } = useUIActions();

  if (props.as === "link") {
    const handleLinkClick = () => {
      // Close sidebar on mobile after navigation starts
      if (isMobile) {
        // Use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
          toggleSidebar();
        });
      }
    };

    return (
      <Link
        href={props.href}
        onClick={handleLinkClick}
        className={cn(
          menuItemBaseStyles({
            isActive: props.isActive,
            className: "relative block py-2",
          }),
          props.className,
        )}
      >
        {props.children}
      </Link>
    );
  }

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent any potential conflicts
    e.stopPropagation();
    props.onClick();
  };

  return (
    <button
      onClick={handleButtonClick}
      aria-expanded={props.isActive}
      type="button"
      className={cn(
        menuItemBaseStyles({
          isActive: props.isActive,
          className: "flex w-full items-center gap-3 py-3",
        }),
        props.className,
      )}
    >
      {props.children}
    </button>
  );
}
