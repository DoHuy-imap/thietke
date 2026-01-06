
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
  saveApiKey: (key: string) => void; // New function
  isAiStudioEnvironment: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'map_app_user_v3';
const API_KEY_STORAGE = 'gemini_api_key';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSettings | null>(null);
  const [isAiStudioEnvironment, setIsAiStudioEnvironment] = useState(false);

  useEffect(() => {
    // Check environment
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      setIsAiStudioEnvironment(true);
    }

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
    // Không xoá API Key khi logout để người dùng không phải nhập lại, trừ khi họ muốn
    // localStorage.removeItem(API_KEY_STORAGE); 
    window.location.reload();
  };

  const deleteAccountData = async () => {
    if (!user) return;
    const { deleteDesignsByAuthor } = await import('../services/historyDb');
    try {
      await deleteDesignsByAuthor(user.displayName);
      logout();
    } catch (error) {
      console.error("Lỗi khi xóa dữ liệu:", error);
      alert("Không thể xóa dữ liệu lúc này.");
    }
  };

  const checkApiKeyStatus = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
        return await (window as any).aistudio.hasSelectedApiKey();
      }
      
      // Kiểm tra process.env
      if (process.env.API_KEY && process.env.API_KEY.length > 0) return true;
      
      // Kiểm tra localStorage
      const localKey = localStorage.getItem(API_KEY_STORAGE);
      if (localKey && localKey.length > 10) return true;

      return false;
    } catch (e) {
      console.warn("Lỗi khi kiểm tra API Key status:", e);
      return false;
    }
  };

  const saveApiKey = (key: string) => {
      if (!key) return;
      localStorage.setItem(API_KEY_STORAGE, key.trim());
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      deleteAccountData,
      checkApiKeyStatus,
      saveApiKey,
      isAiStudioEnvironment
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
