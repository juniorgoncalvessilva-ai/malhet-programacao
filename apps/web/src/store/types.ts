// Global store types

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  imageUrl: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
}

export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'pt' | 'en';
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
  };
  sidebar: {
    collapsed: boolean;
    pinned: boolean;
  };
}

export interface AppState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  user: User | null;
  preferences: AppPreferences;
  notifications: Notification[];
  sidebar: {
    isOpen: boolean;
    isMobile: boolean;
  };
}

export interface AppActions {
  // Initialization
  initializeApp: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // User
  setUser: (user: User | null) => void;
  updateUser: (updates: Partial<User>) => void;
  
  // Preferences
  updatePreferences: (updates: Partial<AppPreferences>) => void;
  resetPreferences: () => void;
  
  // Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  // Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarMobile: (mobile: boolean) => void;
}

export type AppStore = AppState & AppActions;