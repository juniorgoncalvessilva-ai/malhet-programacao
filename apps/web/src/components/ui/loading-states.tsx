"use client";

import { cn } from "@/lib/utils";
import { Loader2, Bell, AlertCircle, RefreshCw } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "size-4",
    md: "size-6",
    lg: "size-8"
  };

  return (
    <Loader2 
      className={cn(
        "animate-spin text-primary", 
        sizeClasses[size], 
        className
      )} 
    />
  );
}

interface NotificationLoadingProps {
  message?: string;
}

export function NotificationLoading({ message = "Loading notifications..." }: NotificationLoadingProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="relative mb-4">
        <Bell className="size-8 text-gray-300 dark:text-gray-600" />
        <LoadingSpinner size="sm" className="absolute -top-1 -right-1" />
      </div>
      <p className="text-sm text-dark-5 dark:text-dark-6 animate-pulse">
        {message}
      </p>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ 
  title = "Something went wrong", 
  message, 
  onRetry, 
  retryLabel = "Try again" 
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <AlertCircle className="size-8 text-red-500 mb-3" />
      <h3 className="text-sm font-medium text-dark dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-sm text-red-600 dark:text-red-400 mb-4 max-w-xs">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary hover:text-primary-dark transition-colors bg-primary/10 hover:bg-primary/20 rounded-lg"
        >
          <RefreshCw className="size-3" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ 
  icon = <Bell className="size-12 text-dark-4 dark:text-dark-5" />, 
  title, 
  description,
  action 
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-dark-5 dark:text-dark-6 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-dark-4 dark:text-dark-5 mb-4">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-3 py-1.5 text-xs font-medium text-primary hover:text-primary-dark transition-colors bg-primary/10 hover:bg-primary/20 rounded-lg"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

interface InlineLoadingProps {
  text: string;
  size?: "sm" | "md";
}

export function InlineLoading({ text, size = "sm" }: InlineLoadingProps) {
  return (
    <div className="flex items-center gap-2">
      <LoadingSpinner size={size} />
      <span className={cn(
        "text-dark-5 dark:text-dark-6 animate-pulse",
        size === "sm" ? "text-xs" : "text-sm"
      )}>
        {text}
      </span>
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className, lines = 1 }: SkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse bg-gray-200 dark:bg-gray-700 rounded",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full",
            className || "h-4"
          )}
        />
      ))}
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="space-y-3 p-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="size-9 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton lines={2} className="h-2" />
            <div className="flex justify-between items-center">
              <Skeleton className="h-2 w-16" />
              <Skeleton className="h-2 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}