
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
  isAiStudioEnvironment: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'map_app_user_v3';

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
      // Nếu không có aistudio, kiểm tra xem process.env.API_KEY có sẵn không
      return !!process.env.API_KEY;
    } catch (e) {
      console.warn("Lỗi khi kiểm tra API Key status:", e);
      return false;
    }
  };

  const requestApiKey = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
    } else {
      alert("Tính năng chọn API Key chỉ khả dụng trong môi trường Google AI Studio. Nếu bạn đang chạy local, hãy đảm bảo đã cấu hình process.env.API_KEY.");
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      deleteAccountData,
      checkApiKeyStatus,
      requestApiKey,
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
