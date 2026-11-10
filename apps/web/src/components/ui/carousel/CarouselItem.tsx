import * as React from "react";
import { cn } from "@/lib/utils";

interface CarouselItemProps extends React.HTMLAttributes<HTMLDivElement> {
  slidesToShow?: number;
}

const CarouselItem = React.forwardRef<
  HTMLDivElement,
  CarouselItemProps
>(({ className, slidesToShow = 1, ...props }, ref) => {
  const flexBasis = `${100 / slidesToShow}%`;
  
  return (
    <div
      ref={ref}
      className={cn("min-w-0 shrink-0 grow-0 pl-4", className)}
      style={{ flexBasis }}
      {...props}
    />
  );
});

CarouselItem.displayName = "CarouselItem";

export { CarouselItem };