import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-300",
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        success: "bg-green text-white hover:bg-green/90",
        warning: "bg-yellow-500 text-white hover:bg-yellow-500/90",
        error: "bg-red-light text-white hover:bg-red-light/90",
        info: "bg-blue-500 text-white hover:bg-blue-500/90",
      },
      size: {
        sm: "px-1.5 py-0.5 text-xs",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
      dot: {
        true: "px-1.5 py-1.5 rounded-full min-w-[1.25rem] h-5 justify-center",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      dot: false,
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  icon?: React.ReactNode;
}

function Badge({
  className,
  variant,
  size,
  dot,
  removable,
  onRemove,
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size, dot, className }))}
      {...props}
    >
      {icon && <span className="w-3 h-3">{icon}</span>}
      {children}
      {removable && (
        <button
          onClick={onRemove}
          className="ml-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5"
          aria-label="Remover badge"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

export { Badge, badgeVariants };