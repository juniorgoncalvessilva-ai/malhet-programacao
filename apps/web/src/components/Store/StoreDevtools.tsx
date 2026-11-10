"use client";

import { useState, useEffect } from 'react';
import { useAppStore, useAuthStore, useUIStore } from '@/store';

interface StoreDevtoolsProps {
  enabled?: boolean;
}

export function StoreDevtools({ enabled = process.env.NODE_ENV === 'development' }: StoreDevtoolsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('app');

  // Get store states
  const appState = useAppStore();
  const authState = useAuthStore();
  const uiState = useUIStore();

  // Don't render in production unless explicitly enabled
  if (!enabled) return null;

  const stores = {
    app: { name: 'App Store', state: appState },
    auth: { name: 'Auth Store', state: authState },
    ui: { name: 'UI Store', state: uiState },
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 rounded-full bg-primary p-3 text-white shadow-lg hover:bg-opacity-90"
        title="Store Devtools"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Devtools Panel */}
      {isOpen && (
        <div className="fixed bottom-16 right-4 z-50 w-96 max-h-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-sm">Store Devtools</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {Object.entries(stores).map(([key, store]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {store.name}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-4 max-h-64 overflow-y-auto">
            <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto">
              {JSON.stringify(stores[activeTab as keyof typeof stores].state, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}

// Store state viewer component for debugging
export function StoreStateViewer() {
  const [selectedStore, setSelectedStore] = useState('app');
  
  const appState = useAppStore();
  const authState = useAuthStore();
  const uiState = useUIStore();

  const stores = {
    app: appState,
    auth: authState,
    ui: uiState,
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Select Store:</label>
        <select
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
          className="w-full rounded border border-stroke px-3 py-2 dark:border-dark-3 dark:bg-dark-2"
        >
          <option value="app">App Store</option>
          <option value="auth">Auth Store</option>
          <option value="ui">UI Store</option>
        </select>
      </div>

      <div className="rounded border border-stroke p-4 dark:border-dark-3">
        <h3 className="mb-2 font-semibold">{selectedStore.toUpperCase()} Store State:</h3>
        <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-auto max-h-64">
          {JSON.stringify(stores[selectedStore as keyof typeof stores], null, 2)}
        </pre>
      </div>
    </div>
  );
}