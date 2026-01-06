
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UserSettings {
  displayName: string;
  apiKey: string;     // Gemini API Key (Main)
  nanoKey?: string;   // Nano Banana Key (Optional/Secondary for Image Gen)
}

interface UserContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  hasCustomKey: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const STORAGE_KEY = 'map_app_user_settings';

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>({
    displayName: 'Designer',
    apiKey: '',
    nanoKey: ''
  });

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({
            displayName: parsed.displayName || 'Designer',
            apiKey: parsed.apiKey || '',
            nanoKey: parsed.nanoKey || ''
        });
      } catch (e) {
        console.error("Failed to parse user settings", e);
      }
    }
  }, []);

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <UserContext.Provider value={{ 
      settings, 
      updateSettings, 
      hasCustomKey: !!settings.apiKey && settings.apiKey.length > 10 
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
