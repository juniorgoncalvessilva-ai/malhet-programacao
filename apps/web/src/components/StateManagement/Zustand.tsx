"use client";

import { useCallback } from 'react';
import { useAppStore, useUIActions, useAppActions, useIsSignedIn, useTheme, useLocaleActions, useLocale } from '@/store';
import { useLocaleSync } from '@/hooks/useLocaleSync';
import { StoreDevtools } from '@/components/Store/StoreDevtools';

export function Zustand() {
  // Using specific selectors (properly memoized)
  const user = useAppStore(useCallback((state) => state.user, []));
  const isLoading = useAppStore(useCallback((state) => state.isLoading, []));
  const notifications = useAppStore(useCallback((state) => state.notifications, []));

  // Using UI action selectors
  const { 
    showToast, 
    setTheme, 
    toggleSidebar
  } = useUIActions();

  // Using App action selectors
  const {
    addNotification,
    clearAllNotifications,
    updatePreferences 
  } = useAppActions();

  // Theme, Auth, and Locale state
  const currentTheme = useTheme();
  const isSignedIn = useIsSignedIn();
  const currentLocale = useLocale();
  const { setLocale: setGlobalLocale, availableLocales } = useLocaleSync();

  const handleShowToast = () => {
    showToast({
      type: 'success',
      message: 'Toast created via Zustand!',
      duration: 3000,
    });
  };

  const handleAddNotification = () => {
    addNotification({
      type: 'info',
      title: 'New Notification',
      message: 'This notification was added to the global store',
    });
  };

  const handleThemeToggle = () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    showToast({
      type: 'info',
      message: `Theme changed to ${newTheme}`,
      duration: 2000,
    });
  };

  const handleUpdatePreferences = () => {
    updatePreferences({
      notifications: {
        email: true,
        push: false,
        marketing: true,
      },
    });
    
    showToast({
      type: 'success',
      message: 'Preferences updated!',
    });
  };

  const simulateLoading = () => {
    useAppStore.setState({ isLoading: true });
    
    setTimeout(() => {
      useAppStore.setState({ isLoading: false });
      showToast({
        type: 'success',
        message: 'Simulated loading completed!',
      });
    }, 2000);
  };

  const handleShowErrorToast = () => {
    showToast({
      type: 'error',
      title: 'Error Example',
      message: 'This is an error toast with title and description',
      duration: 5000,
    });
  };

  const handleShowWarningToast = () => {
    showToast({
      type: 'warning',
      message: 'This is a warning toast',
      duration: 4000,
    });
  };

  const handleLocaleChange = () => {
    const newLocale = currentLocale === 'pt-BR' ? 'en' : 'pt-BR';
    setGlobalLocale(newLocale);
    showToast({
      type: 'info',
      message: `Language changed to ${newLocale === 'pt-BR' ? 'Portuguese' : 'English'}`,
      duration: 2000,
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
        <h2 className="mb-4 text-xl font-semibold">Zustand Store Example</h2>
        
        {/* User Info */}
        <div className="mb-6">
          <h3 className="mb-2 font-medium">User Information:</h3>
          <div className="rounded bg-gray-100 p-3 dark:bg-gray-800">
            <p><strong>Status:</strong> {isSignedIn ? 'Signed In' : 'Not Signed In'}</p>
            {user && (
              <>
                <p><strong>Name:</strong> {user.fullName || 'N/A'}</p>
                <p><strong>Email:</strong> {user.email}</p>
              </>
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="mb-6">
          <h3 className="mb-2 font-medium">
            Notifications ({notifications.length})
          </h3>
          <div className="max-h-32 overflow-y-auto space-y-2">
            {notifications.length > 0 ? (
              notifications.slice(0, 3).map((notification) => (
                <div
                  key={notification.id}
                  className="rounded bg-blue-50 p-2 text-sm dark:bg-blue-900/20"
                >
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    {notification.message}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No notifications</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <button
            onClick={handleShowToast}
            className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600"
          >
            Show Toast
          </button>
          
          <button
            onClick={handleAddNotification}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Add Notification
          </button>
          
          <button
            onClick={handleThemeToggle}
            className="rounded bg-purple-500 px-4 py-2 text-white hover:bg-purple-600"
          >
            Toggle Theme ({currentTheme})
          </button>
          
          <button
            onClick={handleLocaleChange}
            className="rounded bg-cyan-500 px-4 py-2 text-white hover:bg-cyan-600"
          >
            Switch Language ({currentLocale})
          </button>
          
          <button
            onClick={toggleSidebar}
            className="rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
          >
            Toggle Sidebar
          </button>
          
          <button
            onClick={handleUpdatePreferences}
            className="rounded bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-600"
          >
            Update Prefs
          </button>
          
          <button
            onClick={simulateLoading}
            disabled={isLoading}
            className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Simulate Load'}
          </button>
        </div>

        {/* Additional Toast Examples */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          <button
            onClick={handleShowErrorToast}
            className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          >
            Error Toast
          </button>
          
          <button
            onClick={handleShowWarningToast}
            className="rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600"
          >
            Warning Toast
          </button>
          
          <button
            onClick={clearAllNotifications}
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Clear Notifications
          </button>
        </div>
      </div>

      {/* Store State Display */}
      <div className="rounded-lg bg-white p-6 shadow-1 dark:bg-gray-dark">
        <h3 className="mb-4 font-semibold">Store State (Preview):</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <h4 className="mb-2 font-medium">App Store:</h4>
            <div className="rounded bg-gray-100 p-3 dark:bg-gray-800">
              <pre className="text-xs overflow-auto">
                {JSON.stringify({
                  isLoading,
                  userExists: !!user,
                  notificationsCount: notifications.length,
                }, null, 2)}
              </pre>
            </div>
          </div>
          
          <div>
            <h4 className="mb-2 font-medium">Auth Store:</h4>
            <div className="rounded bg-gray-100 p-3 dark:bg-gray-800">
              <pre className="text-xs overflow-auto">
                {JSON.stringify({
                  isSignedIn,
                  hasUser: !!user,
                  userEmail: user?.email || 'N/A',
                }, null, 2)}
              </pre>
            </div>
          </div>
          
          <div>
            <h4 className="mb-2 font-medium">UI Store:</h4>
            <div className="rounded bg-gray-100 p-3 dark:bg-gray-800">
              <pre className="text-xs overflow-auto">
                {JSON.stringify({
                  theme: currentTheme,
                  isLoading,
                  toastsCount: notifications.length,
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <div>
            <h4 className="mb-2 font-medium">Locale Store:</h4>
            <div className="rounded bg-gray-100 p-3 dark:bg-gray-800">
              <pre className="text-xs overflow-auto">
                {JSON.stringify({
                  currentLocale,
                  availableLocales,
                }, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* DevTools component - only shows in development */}
      <StoreDevtools />
    </div>
  );
}