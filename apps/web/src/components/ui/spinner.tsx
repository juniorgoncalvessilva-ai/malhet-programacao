import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import * as React from "react";

const spinnerVariants = cva(
  "inline-block animate-spin",
  {
    variants: {
      variant: {
        ring: "border-2 border-current border-t-transparent rounded-full",
        dots: "flex space-x-1",
        pulse: "rounded-full",
        bars: "flex space-x-1",
        bounce: "flex space-x-1",
      },
      size: {
        xs: "w-3 h-3",
        sm: "w-4 h-4", 
        md: "w-6 h-6",
        lg: "w-8 h-8",
        xl: "w-12 h-12",
      },
      color: {
        primary: "text-primary",
        white: "text-white",
        gray: "text-gray-500",
        success: "text-green",
        warning: "text-yellow-500",
        error: "text-red-light",
      },
      speed: {
        slow: "animate-spin-slow",
        normal: "animate-spin",
        fast: "animate-spin-fast",
      },
    },
    defaultVariants: {
      variant: "ring",
      size: "md",
      color: "primary",
      speed: "normal",
    },
  }
);

export interface SpinnerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof spinnerVariants> {
  text?: string;
  overlay?: boolean;
}

function Spinner({
  className,
  variant = "ring",
  size = "md",
  color = "primary", 
  speed = "normal",
  text,
  overlay,
  ...props
}: SpinnerProps) {
  const renderSpinnerContent = () => {
    switch (variant) {
      case "ring":
        return (
          <div
            className={cn(
              spinnerVariants({ variant, size, color, speed }),
              className
            )}
          />
        );
        
      case "dots":
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "rounded-full animate-pulse bg-current",
                  {
                    "w-1.5 h-1.5": size === "xs",
                    "w-2 h-2": size === "sm",
                    "w-3 h-3": size === "md", 
                    "w-4 h-4": size === "lg",
                    "w-5 h-5": size === "xl",
                  },
                  `text-${color === 'primary' ? 'primary' : color === 'white' ? 'white' : color === 'gray' ? 'gray-500' : color === 'success' ? 'green' : color === 'warning' ? 'yellow-500' : 'red-light'}`,
                )}
                style={{
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        );
        
      case "bars":
        return (
          <div className="flex space-x-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "bg-current animate-bounce",
                  {
                    "w-0.5 h-3": size === "xs",
                    "w-1 h-4": size === "sm",
                    "w-1 h-6": size === "md",
                    "w-2 h-8": size === "lg",
                    "w-2 h-10": size === "xl",
                  },
                  `text-${color === 'primary' ? 'primary' : color === 'white' ? 'white' : color === 'gray' ? 'gray-500' : color === 'success' ? 'green' : color === 'warning' ? 'yellow-500' : 'red-light'}`,
                )}
                style={{
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        );
        
      case "pulse":
        return (
          <div
            className={cn(
              "bg-current rounded-full animate-pulse",
              spinnerVariants({ size }),
              `text-${color === 'primary' ? 'primary' : color === 'white' ? 'white' : color === 'gray' ? 'gray-500' : color === 'success' ? 'green' : color === 'warning' ? 'yellow-500' : 'red-light'}`,
              className
            )}
          />
        );

      case "bounce":
        return (
          <div className="flex space-x-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(
                  "bg-current rounded-full animate-bounce",
                  {
                    "w-1.5 h-1.5": size === "xs",
                    "w-2 h-2": size === "sm",
                    "w-3 h-3": size === "md", 
                    "w-4 h-4": size === "lg",
                    "w-5 h-5": size === "xl",
                  },
                  `text-${color === 'primary' ? 'primary' : color === 'white' ? 'white' : color === 'gray' ? 'gray-500' : color === 'success' ? 'green' : color === 'warning' ? 'yellow-500' : 'red-light'}`,
                )}
                style={{
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        );
        
      default:
        return (
          <div
            className={cn(
              spinnerVariants({ variant, size, color, speed }),
              className
            )}
          />
        );
    }
  };

  const content = (
    <div
      className={cn(
        "flex items-center justify-center gap-2",
        overlay && "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      )}
      {...props}
    >
      {renderSpinnerContent()}
      {text && (
        <span className={cn("text-sm font-medium", `text-${color === 'primary' ? 'primary' : color === 'white' ? 'white' : color === 'gray' ? 'gray-500' : color === 'success' ? 'green' : color === 'warning' ? 'yellow-500' : 'red-light'}`)}>
          {text}
        </span>
      )}
    </div>
  );

  return content;
}

export interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  children: React.ReactNode;
  variant?: SpinnerProps['variant'];
  size?: SpinnerProps['size'];
}

function LoadingOverlay({
  isLoading,
  text = "Carregando...",
  children,
  variant = "ring",
  size = "lg",
}: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2">
            <Spinner variant={variant} size={size} />
            {text && (
              <span className="text-sm font-medium text-muted-foreground">
                {text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { Spinner, LoadingOverlay, spinnerVariants };