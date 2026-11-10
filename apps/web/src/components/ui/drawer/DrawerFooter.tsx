import { cn } from "@/lib/utils";
import * as React from "react";

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-auto pt-4 border-t border-gray-200 dark:border-gray-700",
      className
    )}
    {...props}
  />
);

DrawerFooter.displayName = "DrawerFooter";

export { DrawerFooter };