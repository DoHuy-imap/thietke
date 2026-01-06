
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UserProvider } from './contexts/UserContext';

// Cấu hình Monaco Environment trực tiếp trên window mà không cần import thư viện monaco nặng nề
// Việc trả về null trong getWorker buộc Monaco chạy trên luồng chính (Main Thread),
// tránh lỗi CORS của Web Worker trong môi trường sandbox.
(window as any).MonacoEnvironment = {
  getWorker: function (_workerId: any, _label: string) {
    return null;
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </React.StrictMode>
);
