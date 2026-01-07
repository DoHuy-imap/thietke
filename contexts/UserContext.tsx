
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';

interface UserSettings {
  displayName: string;
}

interface AuthContextType {
  user: UserSettings | null;
  login: (name: string, apiKey?: string) => void;
  logout: () => void;
  deleteAccountData: () => Promise<void>;
  checkApiKeyStatus: () => Promise<boolean>;
  isAiStudioEnvironment: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'map_app_user_v3';
const API_KEY_STORAGE = 'map_app_api_key';
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 phút

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSettings | null>(null);
  const [isAiStudioEnvironment, setIsAiStudioEnvironment] = useState(false);
  
  const timeoutIdRef = useRef<any>(null);

  useEffect(() => {
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

  const login = (name: string, apiKey?: string) => {
    const newUser = { displayName: name };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    if (apiKey) {
      localStorage.setItem(API_KEY_STORAGE, apiKey);
    }
  };

  const logout = useCallback(() => {
    if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
    }
    setUser(null);
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(API_KEY_STORAGE);
    } catch (e) {
        console.error("Error clearing storage:", e);
    }
    setTimeout(() => {
        window.location.reload();
    }, 100);
  }, []);

  useEffect(() => {
    if (!user) return;
    const resetTimer = () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = setTimeout(() => {
        alert("Phiên làm việc đã hết hạn do 30 phút không hoạt động. Vui lòng đăng nhập lại.");
        logout();
      }, INACTIVITY_LIMIT);
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'click'];
    resetTimer();
    const handleActivity = () => resetTimer();
    events.forEach(event => window.addEventListener(event, handleActivity));
    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [user, logout]);

  const deleteAccountData = async () => {
    if (!user) return;
    try {
      const { deleteDesignsByAuthor } = await import('../services/historyDb');
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
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (hasKey) return true;
      }
      if (process.env.API_KEY && process.env.API_KEY.length > 0) return true;
      const savedKey = localStorage.getItem(API_KEY_STORAGE);
      return !!(savedKey && savedKey.length > 10);
    } catch (e) {
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      deleteAccountData,
      checkApiKeyStatus,
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
