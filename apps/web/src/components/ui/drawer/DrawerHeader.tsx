import { cn } from "@/lib/utils";
import * as React from "react";

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className
    )}
    {...props}
  />
);

DrawerHeader.displayName = "DrawerHeader";

export { DrawerHeader };