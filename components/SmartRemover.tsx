
import React, { useRef, useState, useEffect } from 'react';

interface SmartRemoverProps {
  imageUrl: string;
  onClose: () => void;
  onProcess: (maskBase64: string, textDescription: string) => void;
  isProcessing: boolean;
}

interface DrawPath {
  x: number;
  y: number;
  size: number;
}

const SmartRemover: React.FC<SmartRemoverProps> = ({ imageUrl, onClose, onProcess, isProcessing }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const [removalDescription, setRemovalDescription] = useState(''); // New state for text removal
  const [paths, setPaths] = useState<DrawPath[][]>([]); 
  const [currentPath, setCurrentPath] = useState<DrawPath[]>([]);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      ctx.drawImage(img, 0, 0);
    };
  }, [imageUrl]);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    
    if (img.complete) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawPaths(ctx);
    } else {
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            drawPaths(ctx);
        };
    }
  };

  const drawPaths = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'; 

    const allPaths = [...paths, currentPath];
    
    allPaths.forEach(path => {
      if (path.length < 1) return;
      ctx.beginPath();
      ctx.lineWidth = path[0].size;
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    });
  };

  useEffect(() => {
    redraw();
  }, [paths, currentPath]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing) return;
    e.preventDefault(); 
    setIsDrawing(true);
    const coords = getCoordinates(e);
    setCurrentPath([{ x: coords.x, y: coords.y, size: brushSize * (canvasRef.current ? canvasRef.current.width / 1000 : 1) }]); 
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing) return;
    e.preventDefault();
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    const scaledSize = brushSize * (canvasRef.current ? canvasRef.current.width / 1000 : 1);
    setCurrentPath(prev => [...prev, { x: coords.x, y: coords.y, size: scaledSize }]);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPath.length > 0) {
      setPaths(prev => [...prev, currentPath]);
      setCurrentPath([]);
    }
  };

  const handleUndo = () => {
    setPaths(prev => prev.slice(0, -1));
  };

  const handleGenerateMaskAndProcess = () => {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = imageSize.w;
    maskCanvas.height = imageSize.h;
    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return;

    mCtx.fillStyle = '#000000';
    mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    mCtx.lineCap = 'round';
    mCtx.lineJoin = 'round';
    mCtx.strokeStyle = '#FFFFFF';

    paths.forEach(path => {
      if (path.length < 1) return;
      mCtx.beginPath();
      mCtx.lineWidth = path[0].size; 
      mCtx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        mCtx.lineTo(path[i].x, path[i].y);
      }
      mCtx.stroke();
    });

    const maskBase64 = maskCanvas.toDataURL('image/png');
    onProcess(maskBase64, removalDescription);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      {/* Header Controls */}
      <div className="w-full max-w-4xl bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-2xl space-y-4 mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold flex items-center gap-2">
            <div className="bg-red-500/20 p-1.5 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            Xóa Vật Thể Thông Minh (AI Magic Eraser)
          </h3>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-3 bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Kích thước cọ</span>
                <input 
                  type="range" min="5" max="150" 
                  value={brushSize} 
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-24 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
             </div>
             <button 
               onClick={handleUndo}
               disabled={paths.length === 0 || isProcessing}
               className="p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors border border-slate-600 disabled:opacity-30"
               title="Hoàn tác (Undo)"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
               </svg>
             </button>
          </div>
        </div>

        {/* Text Input for AI Removal */}
        <div className="relative group">
           <div className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 group-focus-within:text-purple-300 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
           </div>
           <input 
             type="text" 
             placeholder="Mô tả vật thể muốn xóa (Vd: xóa cái cây, xóa dòng chữ trên sản phẩm...)"
             className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-purple-500/50 outline-none transition-all placeholder-slate-600"
             value={removalDescription}
             onChange={(e) => setRemovalDescription(e.target.value)}
             disabled={isProcessing}
           />
           <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">AI ASSISTANT</span>
           </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className="relative overflow-hidden shadow-2xl rounded-xl border border-slate-700 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] bg-slate-900 flex-shrink-0"
        style={{ maxWidth: '100%', maxHeight: '60vh' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair block max-w-full max-h-full object-contain touch-none"
          style={{ maxHeight: '60vh' }}
        />
        
        {isProcessing && (
           <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex flex-col items-center justify-center z-20">
               <div className="relative">
                  <div className="w-20 h-20 border-4 border-red-500/20 rounded-full"></div>
                  <div className="absolute inset-0 w-20 h-20 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
               </div>
               <p className="text-white font-bold text-xl mt-6 animate-pulse">Đang xóa & Tái tạo nền...</p>
               <p className="text-slate-400 text-sm mt-2 max-w-xs text-center px-4">AI đang phân tích mô tả và vùng chọn để xử lý ảnh 4K</p>
           </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-6 flex gap-4 w-full max-w-4xl justify-end">
         <button 
           onClick={onClose}
           className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors border border-slate-700"
           disabled={isProcessing}
         >
           Đóng
         </button>
         <button 
           onClick={handleGenerateMaskAndProcess}
           disabled={(paths.length === 0 && !removalDescription.trim()) || isProcessing}
           className="px-10 py-3 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-xl shadow-red-900/40 flex items-center gap-3 transition-all transform hover:scale-[1.02]"
         >
           {isProcessing ? 'Đang Xử Lý...' : 'Xác Nhận Xóa'}
           {!isProcessing && (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
               </svg>
           )}
         </button>
      </div>
      
      <div className="mt-6 p-4 bg-slate-900/50 border border-slate-800 rounded-lg max-w-2xl">
         <p className="text-[10px] text-slate-500 text-center leading-relaxed">
           <strong className="text-red-400 uppercase tracking-tighter">Mẹo chuyên gia:</strong> Bạn có thể chỉ cần nhập văn bản (Vd: "xóa cái cây") mà không cần vẽ, 
           hoặc kết hợp cả hai để đạt độ chính xác cao nhất đối với những vật thể có hình dáng phức tạp.
         </p>
      </div>
    </div>
  );
};

export default SmartRemover;
