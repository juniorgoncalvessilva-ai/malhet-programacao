import * as React from "react";
import { cn } from "@/lib/utils";

interface CarouselThumbsProps {
  thumbs: string[];
  selectedIndex: number;
  onThumbClick: (index: number) => void;
  className?: string;
}

const CarouselThumbs: React.FC<CarouselThumbsProps> = ({
  thumbs,
  selectedIndex,
  onThumbClick,
  className,
}) => (
  <div className={cn("flex justify-center gap-2 mt-4 overflow-x-auto pb-2", className)}>
    {thumbs.map((thumb, index) => (
      <button
        key={index}
        type="button"
        className={cn(
          "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
          index === selectedIndex
            ? "border-primary ring-2 ring-primary ring-opacity-50"
            : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
        )}
        onClick={() => onThumbClick(index)}
        aria-label={`Visualizar slide ${index + 1}`}
      >
        {/* Placeholder para thumb - em produção usar imagem real */}
        <div className={cn(
          "w-full h-full bg-gradient-to-br",
          index % 5 === 0 && "from-blue-400 to-purple-500",
          index % 5 === 1 && "from-green-400 to-blue-500",
          index % 5 === 2 && "from-purple-400 to-pink-500",
          index % 5 === 3 && "from-yellow-400 to-orange-500",
          index % 5 === 4 && "from-pink-400 to-red-500"
        )} />
      </button>
    ))}
  </div>
);

export { CarouselThumbs };