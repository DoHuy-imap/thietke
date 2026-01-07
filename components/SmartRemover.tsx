
import React, { useRef, useState, useEffect } from 'react';
import { upscaleImageTo4K } from '../services/geminiService';

const triggerDownload = (base64Data: string, fileName: string) => {
  try {
    const parts = base64Data.split(';base64,');
    if (parts.length !== 2) return false;
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
    const blob = new Blob([uInt8Array], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => window.URL.revokeObjectURL(url), 100);
    return true;
  } catch (e) { return false; }
};

interface SmartRemoverProps {
  imageUrl: string;
  onClose: () => void;
  onProcess: (maskBase64: string, textDescription: string) => void;
  isProcessing: boolean;
  resultUrl?: string | null;
  aspectRatio?: string; 
}

interface DrawPath {
  x: number;
  y: number;
  size: number;
}

const SmartRemover: React.FC<SmartRemoverProps> = ({ imageUrl, onClose, onProcess, isProcessing, resultUrl, aspectRatio = "1:1" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [removalDescription, setRemovalDescription] = useState('');
  const [paths, setPaths] = useState<DrawPath[][]>([]); 
  const [currentPath, setCurrentPath] = useState<DrawPath[]>([]);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [showOriginal, setShowOriginal] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);

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
    if (!canvas || resultUrl) return; 
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
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'; 
    const allPaths = [...paths, currentPath];
    allPaths.forEach(path => {
      if (path.length < 1) return;
      ctx.beginPath();
      ctx.lineWidth = path[0].size;
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
    });
  };

  useEffect(() => { if (!resultUrl) redraw(); }, [paths, currentPath, resultUrl]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing || resultUrl) return;
    setIsDrawing(true);
    const coords = getCoordinates(e);
    setCurrentPath([{ x: coords.x, y: coords.y, size: brushSize * (canvasRef.current ? canvasRef.current.width / 1000 : 1) }]); 
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing || !isDrawing || resultUrl) return;
    const coords = getCoordinates(e);
    const scaledSize = brushSize * (canvasRef.current ? canvasRef.current.width / 1000 : 1);
    setCurrentPath(prev => [...prev, { x: coords.x, y: coords.y, size: scaledSize }]);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPath.length > 0) { setPaths(prev => [...prev, currentPath]); setCurrentPath([]); }
  };

  const handleProcess = () => {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = imageSize.w;
    maskCanvas.height = imageSize.h;
    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return;
    mCtx.fillStyle = '#000000';
    mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    mCtx.lineCap = 'round'; mCtx.lineJoin = 'round'; mCtx.strokeStyle = '#FFFFFF';
    paths.forEach(path => {
      if (path.length < 1) return;
      mCtx.beginPath();
      mCtx.lineWidth = path[0].size; 
      mCtx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) mCtx.lineTo(path[i].x, path[i].y);
      mCtx.stroke();
    });
    onProcess(maskCanvas.toDataURL('image/png'), removalDescription);
  };

  const handleDownload4K = async () => {
      if (!resultUrl) return;
      setIsUpscaling(true);
      try {
          const res = await upscaleImageTo4K(resultUrl, aspectRatio);
          triggerDownload(res, `map-erased-4k-${Date.now()}.png`);
      } catch (e) { alert("Lỗi nâng cấp 4K."); }
      finally { setIsUpscaling(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/98 flex flex-col items-center justify-center p-6 backdrop-blur-3xl animate-fade-in">
      <div className="w-full max-w-5xl bg-slate-900/50 p-6 rounded-[3rem] border border-white/10 shadow-2xl backdrop-blur-xl mb-6 relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
             <div className="bg-red-500 p-3 rounded-2xl shadow-lg shadow-red-500/20">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9z" clipRule="evenodd" />
               </svg>
             </div>
             <div>
                <h3 className="text-white text-xl font-black uppercase tracking-tighter">AI Smart Eraser Pro</h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Hậu kỳ xóa & tái tạo thông minh</p>
             </div>
          </div>

          <div className="flex items-center gap-4">
             {!resultUrl && !isProcessing && (
                 <div className="flex items-center gap-4 bg-slate-950 px-5 py-2.5 rounded-2xl border border-white/5">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Brush</span>
                    <input type="range" min="10" max="200" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-32 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500" />
                    <button onClick={() => setPaths(prev => prev.slice(0, -1))} disabled={paths.length === 0} className="p-2 text-slate-400 hover:text-white disabled:opacity-20 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                 </div>
             )}
             {resultUrl && (
                 <button 
                    onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)} onTouchStart={() => setShowOriginal(true)} onTouchEnd={() => setShowOriginal(false)}
                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5 active:scale-95 select-none"
                 >
                    Giữ để So sánh
                 </button>
             )}
             <button onClick={onClose} disabled={isProcessing} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 transition-all disabled:opacity-50"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>

        {!resultUrl && !isProcessing && (
            <div className="mt-6 flex gap-4">
               <div className="relative flex-1">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-red-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                  <input type="text" placeholder="Nhập tên vật thể muốn xóa (Vd: logo, cái cây, người...)" className="w-full bg-slate-950 border border-white/5 rounded-2xl pl-12 pr-6 py-4 text-xs text-white focus:ring-2 focus:ring-red-500/30 outline-none transition-all placeholder-slate-700 font-bold" value={removalDescription} onChange={(e) => setRemovalDescription(e.target.value)} />
               </div>
               <button onClick={handleProcess} disabled={(paths.length === 0 && !removalDescription) || isProcessing} className="px-10 bg-red-600 hover:bg-red-500 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-red-600/20 transition-all active:scale-95 disabled:opacity-20 border-t border-white/20">Thực hiện Xóa</button>
            </div>
        )}
      </div>

      <div className="relative flex-grow flex items-center justify-center max-w-full overflow-hidden rounded-[3.5rem] bg-slate-950 border border-white/5 shadow-2xl">
         {resultUrl && !showOriginal ? (
             <img src={resultUrl} className="max-w-full max-h-full object-contain animate-fade-in" alt="Result" />
         ) : (
             <canvas ref={canvasRef} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} className={`block max-w-full max-h-full object-contain touch-none ${!resultUrl ? 'cursor-crosshair' : ''}`} />
         )}
         
         {isProcessing && (
             <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center">
                 <div className="relative">
                    <div className="w-24 h-24 border-4 border-red-500/20 rounded-full animate-pulse"></div>
                    <div className="absolute top-0 left-0 w-24 h-24 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                 </div>
                 <p className="text-white font-black uppercase tracking-[0.3em] mt-8 animate-pulse text-sm">Đang tái cấu trúc bối cảnh...</p>
                 <p className="text-[10px] text-slate-500 uppercase mt-2 font-bold tracking-widest">Hệ thống AI Eraser đang làm việc</p>
             </div>
         )}
      </div>

      {resultUrl && (
          <div className="mt-8 flex gap-6 w-full max-w-2xl relative z-10">
             <button onClick={() => { setPaths([]); setRemovalDescription(''); onClose(); }} className="flex-1 py-5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5">Đóng & Lưu kết quả</button>
             <button onClick={handleDownload4K} disabled={isUpscaling} className="flex-[2] py-5 bg-gradient-to-r from-[#FFD300] to-[#FFA000] text-black text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-[#FFD300]/20 transition-all active:scale-95 disabled:opacity-50 border-t border-white/20">
                {isUpscaling ? 'Đang Nâng Cấp...' : 'Tải File Kết Quả 4K'}
             </button>
          </div>
      )}
    </div>
  );
};

export default SmartRemover;
