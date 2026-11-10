"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const drawerContentVariants = cva(
  "fixed z-50 gap-4 bg-white p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 dark:bg-gray-dark dark:border-gray-700",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
      size: {
        sm: "",
        md: "",
        lg: "",
        xl: "",
        full: "",
      },
    },
    compoundVariants: [
      {
        side: ["top", "bottom"],
        size: "sm",
        class: "max-h-[30vh]",
      },
      {
        side: ["top", "bottom"],
        size: "md",
        class: "max-h-[50vh]",
      },
      {
        side: ["top", "bottom"],
        size: "lg",
        class: "max-h-[70vh]",
      },
      {
        side: ["top", "bottom"],
        size: "xl",
        class: "max-h-[85vh]",
      },
      {
        side: ["top", "bottom"],
        size: "full",
        class: "max-h-[95vh]",
      },
      {
        side: ["left", "right"],
        size: "sm",
        class: "sm:max-w-xs",
      },
      {
        side: ["left", "right"],
        size: "md",
        class: "sm:max-w-md",
      },
      {
        side: ["left", "right"],
        size: "lg",
        class: "sm:max-w-lg",
      },
      {
        side: ["left", "right"],
        size: "xl",
        class: "sm:max-w-xl",
      },
      {
        side: ["left", "right"],
        size: "full",
        class: "sm:max-w-[95vw]",
      },
    ],
    defaultVariants: {
      side: "right",
      size: "md",
    },
  }
);

interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof drawerContentVariants> {
  showClose?: boolean;
}

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(({ side = "right", size = "md", className, showClose = true, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(drawerContentVariants({ side, size }), className)}
      {...props}
    >
      {children}
      {showClose && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));

DrawerContent.displayName = DialogPrimitive.Content.displayName;

export { DrawerContent, drawerContentVariants };