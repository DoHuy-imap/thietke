
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UserSettings {
  displayName: string;
}

interface AuthContextType {
  user: UserSettings | null;
  login: (name: string) => void;
  logout: () => void;
  deleteAccountData: () => Promise<void>;
  checkApiKeyStatus: () => Promise<boolean>;
  requestApiKey: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'map_app_user_v2';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSettings | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const login = (name: string) => {
    const newUser = { displayName: name };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const deleteAccountData = async () => {
    if (!user) return;
    const { deleteDesignsByAuthor } = await import('../services/historyDb');
    await deleteDesignsByAuthor(user.displayName);
    logout();
  };

  const checkApiKeyStatus = async () => {
    return await (window as any).aistudio.hasSelectedApiKey();
  };

  const requestApiKey = async () => {
    await (window as any).aistudio.openSelectKey();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      deleteAccountData,
      checkApiKeyStatus,
      requestApiKey
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
