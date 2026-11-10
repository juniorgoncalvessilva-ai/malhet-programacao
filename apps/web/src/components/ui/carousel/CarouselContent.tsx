import * as React from "react";
import { cn } from "@/lib/utils";

const CarouselContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex", className)}
    {...props}
  />
));

CarouselContent.displayName = "CarouselContent";

export { CarouselContent };