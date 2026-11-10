"use client";

import { cn } from "@/lib/utils";
import { cva, VariantProps } from "class-variance-authority";
import { useState, useRef, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

const tooltipVariants = cva(
  "absolute z-[9999] pointer-events-none transform transition-all duration-200 ease-in-out",
  {
    variants: {
      variant: {
        default: "bg-gray-900 text-white dark:bg-gray-700",
        light: "bg-white text-gray-900 border border-gray-200 dark:border-gray-600",
        primary: "bg-primary text-white",
        error: "bg-red text-white",
        success: "bg-green text-white",
        warning: "bg-yellow-500 text-white",
      },
      size: {
        sm: "px-2 py-1 text-xs",
        default: "px-3 py-2 text-sm",
        lg: "px-4 py-3 text-base",
      },
      placement: {
        top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
        bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
        left: "right-full top-1/2 -translate-y-1/2 mr-2",
        right: "left-full top-1/2 -translate-y-1/2 ml-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      placement: "top",
    },
  }
);

const arrowVariants = cva("absolute w-2 h-2 transform rotate-45", {
  variants: {
    variant: {
      default: "bg-gray-900 dark:bg-gray-700",
      light: "bg-white border border-gray-200 dark:border-gray-600",
      primary: "bg-primary",
      error: "bg-red",
      success: "bg-green",
      warning: "bg-yellow-500",
    },
    placement: {
      top: "top-full left-1/2 -translate-x-1/2 -translate-y-1/2",
      bottom: "bottom-full left-1/2 -translate-x-1/2 translate-y-1/2",
      left: "left-full top-1/2 -translate-x-1/2 -translate-y-1/2",
      right: "right-full top-1/2 translate-x-1/2 -translate-y-1/2",
    },
  },
  defaultVariants: {
    variant: "default",
    placement: "top",
  },
});

interface TooltipPosition {
  x: number;
  y: number;
}

export interface TooltipProps extends VariantProps<typeof tooltipVariants> {
  children: ReactNode;
  content: ReactNode;
  disabled?: boolean;
  showArrow?: boolean;
  delay?: number;
  className?: string;
  contentClassName?: string;
  triggerClassName?: string;
}

export function Tooltip({
  children,
  content,
  variant = "default",
  size = "default",
  placement = "top",
  disabled = false,
  showArrow = true,
  delay = 300,
  className,
  contentClassName,
  triggerClassName,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculatePosition = (): TooltipPosition => {
    if (!triggerRef.current) return { x: 0, y: 0 };

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    let x = triggerRect.left + scrollX;
    let y = triggerRect.top + scrollY;

    switch (placement) {
      case "top":
        x += triggerRect.width / 2;
        y -= 8;
        break;
      case "bottom":
        x += triggerRect.width / 2;
        y += triggerRect.height + 8;
        break;
      case "left":
        x -= 8;
        y += triggerRect.height / 2;
        break;
      case "right":
        x += triggerRect.width + 8;
        y += triggerRect.height / 2;
        break;
    }

    return { x, y };
  };

  const showTooltip = () => {
    if (disabled || !content) return;

    timeoutRef.current = setTimeout(() => {
      setPosition(calculatePosition());
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isVisible) {
      const handleScroll = () => {
        setPosition(calculatePosition());
      };

      const handleResize = () => {
        setPosition(calculatePosition());
      };

      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [isVisible, placement]);

  const tooltipContent = isVisible && (
    <div
      ref={tooltipRef}
      className={cn(
        tooltipVariants({ variant, size, placement }),
        "rounded-md shadow-xl whitespace-nowrap max-w-xs",
        contentClassName
      )}
      style={{
        left: position.x,
        top: position.y,
      }}
      role="tooltip"
      aria-hidden={!isVisible}
    >
      {content}
      {showArrow && (
        <div
          className={cn(
            arrowVariants({ variant, placement }),
            placement === "left" && "border-r-0 border-b-0",
            placement === "right" && "border-l-0 border-t-0",
            placement === "top" && "border-t-0 border-l-0",
            placement === "bottom" && "border-b-0 border-r-0"
          )}
        />
      )}
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className={cn("inline-block", triggerClassName)}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        tabIndex={0}
      >
        {children}
      </div>
      {typeof document !== "undefined" && createPortal(tooltipContent, document.body)}
    </>
  );
}

// Hook para uso mais simples
export function useTooltip() {
  const [isVisible, setIsVisible] = useState(false);
  const [content, setContent] = useState<ReactNode>(null);
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0 });

  const showTooltip = (content: ReactNode, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    setContent(content);
    setPosition({
      x: rect.right + scrollX + 8,
      y: rect.top + scrollY + rect.height / 2,
    });
    setIsVisible(true);
  };

  const hideTooltip = () => {
    setIsVisible(false);
    setContent(null);
  };

  const TooltipPortal = () => {
    if (!isVisible || !content) return null;

    return createPortal(
      <div
        className="fixed z-[9999] pointer-events-none"
        style={{
          left: position.x,
          top: position.y,
          transform: "translateY(-50%)",
        }}
      >
        <div className="relative">
          <div className="whitespace-nowrap rounded-md bg-gray-900 px-3 py-2 text-sm text-white shadow-xl dark:bg-gray-700">
            {content}
          </div>
          <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 h-2 w-2 rotate-45 bg-gray-900 dark:bg-gray-700" />
        </div>
      </div>,
      document.body
    );
  };

  return {
    showTooltip,
    hideTooltip,
    TooltipPortal,
    isVisible,
  };
} 