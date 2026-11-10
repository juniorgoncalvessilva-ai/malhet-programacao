"use client";

import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useTranslations } from 'next-intl';
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useState, useEffect } from "react";
import { BellIcon } from "./icons";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotificationsQuery";
import { formatDistanceToNow } from 'date-fns';
import { Trash2, Check, CheckCheck, X, AlertCircle, Info, CheckCircle, XCircle } from 'lucide-react';
import { NotificationLoading, ErrorState, EmptyState, InlineLoading } from '@/components/ui/loading-states';

export function Notification() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [previousUnreadCount, setPreviousUnreadCount] = useState(0);
  const isMobile = useIsMobile();
  const t = useTranslations('Notifications');
  
  const {
    notifications,
    recentNotifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
  } = useRealtimeNotifications();
  
  // Animation for new notifications
  useEffect(() => {
    if (unreadCount > previousUnreadCount && previousUnreadCount > 0) {
      setHasNewNotifications(true);
      const timer = setTimeout(() => setHasNewNotifications(false), 2000);
      return () => clearTimeout(timer);
    }
    setPreviousUnreadCount(unreadCount);
  }, [unreadCount, previousUnreadCount]);

  const handleNotificationClick = async (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      await markAsRead(notificationId);
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="size-4 text-green-500" />;
      case 'error':
        return <XCircle className="size-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="size-4 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="size-4 text-blue-500" />;
    }
  };

  return (
    <Dropdown
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    >
      <DropdownTrigger
        className={cn(
          "grid size-12 place-items-center rounded-full border bg-gray-2 text-dark outline-none transition-all duration-200 hover:text-primary hover:scale-105 focus-visible:border-primary focus-visible:text-primary dark:border-dark-4 dark:bg-dark-3 dark:text-white dark:focus-visible:border-primary",
          hasNewNotifications && "animate-pulse border-primary text-primary"
        )}
        aria-label="View Notifications"
      >
        <span className="relative">
          <BellIcon />

          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 z-10">
              <span className={cn(
                "flex items-center justify-center size-5 text-xs font-bold text-white bg-red-500 rounded-full ring-2 ring-gray-2 dark:ring-dark-3 transition-all duration-200",
                hasNewNotifications && "animate-bounce"
              )}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-75" />
            </span>
          )}
        </span>
      </DropdownTrigger>

      <DropdownContent
        align={isMobile ? "end" : "center"}
        className="border border-stroke bg-white shadow-lg dark:border-dark-3 dark:bg-gray-dark min-[350px]:min-w-[22rem] max-w-[24rem] animate-in slide-in-from-top-2 duration-200"
      >
        <div className="border-b border-stroke dark:border-dark-3 pb-3 mb-3">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <BellIcon className="size-5 text-primary" />
              <span className="text-lg font-semibold text-dark dark:text-white">
                {t('title')}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">
                  {unreadCount} {t('newNotifications')}
                </span>
              )}
            </div>
          </div>
          
          {(unreadCount > 0 || notifications.length > 0) && (
            <div className="flex items-center gap-2 px-3 pt-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary-dark transition-colors"
                  disabled={loading}
                >
                  <CheckCheck className="size-3" />
                  {t('markAllRead')}
                </button>
              )}
              
              {notifications.length > 0 && (
                <button
                  onClick={() => clearAllNotifications()}
                  className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 transition-colors"
                  disabled={loading}
                >
                  <Trash2 className="size-3" />
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        <div className="max-h-[24rem] notification-scrollbar">
          {loading ? (
            <NotificationLoading message="Loading your notifications..." />
          ) : error ? (
            <ErrorState
              title="Failed to load notifications"
              message={error}
              onRetry={() => window.location.reload()}
              retryLabel="Reload"
            />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={<BellIcon className="size-12 text-dark-4 dark:text-dark-5" />}
              title={t('noNotifications')}
              description="You're all caught up! New notifications will appear here."
            />
          ) : (
            <div className="space-y-1">
              {recentNotifications.map((notification, index) => (
                <div
                  key={notification.id}
                  className={cn(
                    "group relative transition-all duration-200 hover:bg-gray-1 dark:hover:bg-dark-2 rounded-lg",
                    !notification.read && "bg-blue-50 dark:bg-blue-950/20 border-l-3 border-primary"
                  )}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  <div className="px-3 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {notification.sender_avatar ? (
                          <Image
                            src={notification.sender_avatar}
                            className="size-9 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-700"
                            width={36}
                            height={36}
                            alt={notification.sender_name || "User"}
                          />
                        ) : (
                          <div className="size-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            {getNotificationIcon(notification.type)}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-dark dark:text-white truncate">
                            {notification.title}
                          </h4>
                          
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.read && (
                              <div className="size-2 rounded-full bg-primary animate-pulse" />
                            )}
                            
                            <button
                              onClick={(e) => handleDeleteNotification(e, notification.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 hover:text-red-700"
                              title="Delete notification"
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        </div>

                        <p className="text-sm text-dark-5 dark:text-dark-6 line-clamp-2 mb-2">
                          {notification.message}
                        </p>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-dark-4 dark:text-dark-5">
                            {notification.created_at && formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                          
                          <div className="flex items-center gap-2">
                            {notification.sender_name && (
                              <span className="text-xs text-dark-4 dark:text-dark-5">
                                {notification.sender_name}
                              </span>
                            )}
                            
                            {!notification.read && (
                              <button
                                onClick={() => handleNotificationClick(notification.id, notification.read)}
                                className="text-xs text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
                              >
                                <Check className="size-3" />
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {notifications.length > 10 && (
          <div className="border-t border-stroke dark:border-dark-3 pt-3 mt-3">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block rounded-lg border border-primary bg-primary/5 hover:bg-primary hover:text-white p-3 text-center text-sm font-medium tracking-wide text-primary outline-none transition-all duration-200 focus-visible:border-primary dark:border-primary dark:bg-primary/10 dark:text-primary dark:hover:bg-primary dark:hover:text-white"
            >
              {t('seeAll')} ({notifications.length})
            </Link>
          </div>
        )}
      </DropdownContent>
    </Dropdown>
  );
}
