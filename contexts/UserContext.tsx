import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';

interface UserSettings {
  displayName: string;
}

interface AuthContextType {
  user: UserSettings | null;
  login: (name: string) => void;
  logout: () => void;
  deleteAccountData: () => Promise<void>;
  checkApiKeyStatus: () => Promise<boolean>;
  saveApiKey: (key: string) => void; 
  isAiStudioEnvironment: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'map_app_user_v3';
const API_KEY_STORAGE = 'gemini_api_key';
const INACTIVITY_LIMIT = 30 * 60 * 1000; // 30 phút

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSettings | null>(null);
  const [isAiStudioEnvironment, setIsAiStudioEnvironment] = useState(false);
  
  // Sử dụng useRef để lưu timeout ID, tránh vấn đề scope và re-render
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const logout = useCallback(() => {
    // Xóa timer nếu đang chạy
    if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
    
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    
    // YÊU CẦU QUAN TRỌNG: Xóa API Key để người dùng phải nhập lại
    localStorage.removeItem(API_KEY_STORAGE);
    
    // Tải lại trang để xóa sạch bộ nhớ và reset về màn hình Login
    window.location.reload();
  }, []);

  // --- AUTO LOGOUT LOGIC ---
  useEffect(() => {
    if (!user) return; // Chỉ chạy khi đã đăng nhập

    const resetTimer = () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = setTimeout(() => {
        alert("Phiên làm việc đã hết hạn do 30 phút không hoạt động. Vui lòng đăng nhập lại.");
        logout();
      }, INACTIVITY_LIMIT);
    };

    // Các sự kiện được coi là "hoạt động"
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'click'];
    
    // Khởi tạo timer lần đầu
    resetTimer();

    // Hàm xử lý sự kiện (chỉ đơn giản là reset timer)
    const handleActivity = () => resetTimer();

    // Gán sự kiện vào window để bắt trọn vẹn nhất
    events.forEach(event => window.addEventListener(event, handleActivity));

    // Cleanup khi component unmount hoặc user logout
    return () => {
      if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [user, logout]);
  // -------------------------

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
      
      // Nếu có key trong env, ưu tiên trả về true (App tự cấu hình)
      if (process.env.API_KEY && process.env.API_KEY.length > 0) return true;
      
      // Kiểm tra localStorage (Key người dùng nhập)
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