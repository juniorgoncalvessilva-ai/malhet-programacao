import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CarouselArrowsProps {
  onPrev: () => void;
  onNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
  className?: string;
}

const CarouselArrows: React.FC<CarouselArrowsProps> = ({
  onPrev,
  onNext,
  canScrollPrev,
  canScrollNext,
  className,
}) => (
  <>
    <button
      type="button"
      className={cn(
        "absolute left-2 top-1/2 -translate-y-1/2 z-10",
        "w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80",
        "flex items-center justify-center",
        "shadow-md hover:bg-white dark:hover:bg-gray-800",
        "transition-all duration-200",
        !canScrollPrev && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={onPrev}
      disabled={!canScrollPrev}
      aria-label="Slide anterior"
    >
      <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
    </button>

    <button
      type="button"
      className={cn(
        "absolute right-2 top-1/2 -translate-y-1/2 z-10",
        "w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80",
        "flex items-center justify-center",
        "shadow-md hover:bg-white dark:hover:bg-gray-800",
        "transition-all duration-200",
        !canScrollNext && "opacity-50 cursor-not-allowed",
        className
      )}
      onClick={onNext}
      disabled={!canScrollNext}
      aria-label="Próximo slide"
    >
      <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
    </button>
  </>
);

export { CarouselArrows };