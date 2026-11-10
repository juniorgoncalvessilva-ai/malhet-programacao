import * as React from "react";
import { cn } from "@/lib/utils";

interface CarouselDotsProps {
  scrollSnaps: number[];
  selectedIndex: number;
  onDotClick: (index: number) => void;
  className?: string;
}

const CarouselDots: React.FC<CarouselDotsProps> = ({
  scrollSnaps,
  selectedIndex,
  onDotClick,
  className,
}) => (
  <div className={cn("flex justify-center gap-2 mt-4", className)}>
    {scrollSnaps.map((_, index) => (
      <button
        key={index}
        type="button"
        className={cn(
          "w-2.5 h-2.5 rounded-full transition-colors",
          index === selectedIndex
            ? "bg-primary"
            : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
        )}
        onClick={() => onDotClick(index)}
        aria-label={`Ir para slide ${index + 1}`}
      />
    ))}
  </div>
);

export { CarouselDots };