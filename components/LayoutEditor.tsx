
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutSuggestion, LayoutElement } from '../types';

interface LayoutEditorProps {
  layout: LayoutSuggestion;
  onLayoutChange: (updatedLayout: LayoutSuggestion) => void;
  onConfirm: (maskBase64: string) => void;
  onUpdateDescription: (updatedLayout: LayoutSuggestion) => void;
  isUpdatingDescription: boolean;
}

const LayoutEditor: React.FC<LayoutEditorProps> = ({ 
    layout, 
    onLayoutChange, 
    onConfirm, 
    onUpdateDescription,
    isUpdatingDescription 
}) => {
  const [elements, setElements] = useState<LayoutElement[]>(layout.elements);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<LayoutElement[][]>([layout.elements]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const currentHistoryHead = JSON.stringify(history[historyIndex]);
    const incomingLayout = JSON.stringify(layout.elements);
    if (currentHistoryHead !== incomingLayout) {
        setElements(layout.elements);
        setHistory([layout.elements]);
        setHistoryIndex(0);
    }
  }, [layout]); 

  const addToHistory = (newElements: LayoutElement[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newElements)));
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = useCallback(() => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          const prevElements = history[newIndex];
          setElements(prevElements);
          setHistoryIndex(newIndex);
          onLayoutChange({ ...layout, elements: prevElements });
      }
  }, [history, historyIndex, layout, onLayoutChange]);

  const handleRedo = useCallback(() => {
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          const nextElements = history[newIndex];
          setElements(nextElements);
          setHistoryIndex(newIndex);
          onLayoutChange({ ...layout, elements: nextElements });
      }
  }, [history, historyIndex, layout, onLayoutChange]);

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              e.preventDefault();
              if (e.shiftKey) handleRedo(); else handleUndo();
          } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
              e.preventDefault();
              handleRedo();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleMouseDown = (e: React.MouseEvent, id: string, type: 'move' | 'resize') => {
    e.stopPropagation();
    setActiveId(id);
    setSelectedId(id);
    setStartPos({ x: e.clientX, y: e.clientY });
    if (type === 'move') setIsDragging(true);
    if (type === 'resize') setIsResizing(true);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (!file) return; 
      const reader = new FileReader();
      reader.onload = (event) => {
          if (event.target?.result) {
              const src = event.target.result as string;
              const img = new Image();
              img.src = src;
              img.onload = () => {
                  const imageRatio = img.naturalWidth / img.naturalHeight;
                  const [wR, hR] = layout.canvas_ratio.split(':').map(Number);
                  const canvasRatio = (wR && hR) ? (wR / hR) : 1;
                  const updatedElements = elements.map(el => {
                      if (el.id !== targetId) return el;
                      const newHeight = (el.rect.width * canvasRatio) / imageRatio;
                      return { ...el, image: src, imageRatio: imageRatio, rect: { ...el.rect, height: Math.min(100, newHeight) } };
                  });
                  setElements(updatedElements);
                  addToHistory(updatedElements);
                  onLayoutChange({ ...layout, elements: updatedElements });
              };
          }
      };
      reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault(); 

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging || isResizing) {
        setIsDragging(false);
        setIsResizing(false);
        setActiveId(null);
        addToHistory(elements);
        onLayoutChange({ ...layout, elements });
      }
    };
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeId || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const deltaXPercent = ((e.clientX - startPos.x) / containerRect.width) * 100;
      const deltaYPercent = ((e.clientY - startPos.y) / containerRect.height) * 100;

      if (isDragging) {
        setElements(prev => prev.map(el => el.id !== activeId ? el : {
          ...el, rect: { ...el.rect, x: el.rect.x + deltaXPercent, y: el.rect.y + deltaYPercent }
        }));
        setStartPos({ x: e.clientX, y: e.clientY });
      }
      if (isResizing) {
        setElements(prev => prev.map(el => {
            if (el.id !== activeId) return el;
            const newWidth = Math.max(5, el.rect.width + deltaXPercent);
            let newHeight = Math.max(5, el.rect.height + deltaYPercent);
            if (el.imageRatio) {
                const [wR, hR] = layout.canvas_ratio.split(':').map(Number);
                const canvasRatio = (wR && hR) ? (wR / hR) : 1;
                newHeight = (newWidth * canvasRatio) / el.imageRatio;
            }
            return { ...el, rect: { ...el.rect, width: newWidth, height: newHeight } };
        }));
        setStartPos({ x: e.clientX, y: e.clientY });
      }
    };
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, activeId, startPos, elements, layout, onLayoutChange, history, historyIndex]);

  const generateCleanMask = (): string => {
      const canvas = document.createElement('canvas');
      const width = 1024; 
      const [wRatio, hRatio] = layout.canvas_ratio.split(':').map(Number);
      const ratio = (wRatio && hRatio) ? wRatio / hRatio : 1;
      const height = Math.round(width / ratio);
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      elements.forEach(el => {
          const rx = (el.rect.x / 100) * width;
          const ry = (el.rect.y / 100) * height;
          const rw = (el.rect.width / 100) * width;
          const rh = (el.rect.height / 100) * height;
          ctx.fillStyle = el.color; 
          ctx.fillRect(rx, ry, rw, rh);
      });
      return canvas.toDataURL('image/png');
  };

  const getElementLabel = (type: string, name: string) => {
    // Determine label by type or by scanning the name for Main Title markers
    if (type === 'logo') return 'BRAND LOGO';
    if (type === 'subject') return 'CHỦ THỂ';
    if (type === 'decor') return 'TRANG TRÍ';
    if (type === 'text') {
        if (name.toLowerCase().includes('main') || name.toLowerCase().includes('headline')) return 'TIÊU ĐỀ CHÍNH';
        return 'NỘI DUNG';
    }
    return 'KHỐI';
  };

  const getElementTheme = (type: string, name: string) => {
    if (type === 'subject') return { bg: 'rgba(16, 185, 129, 0.5)', border: 'border-emerald-500' };
    if (type === 'logo') return { bg: 'rgba(234, 179, 8, 0.5)', border: 'border-yellow-500' };
    if (type === 'decor') return { bg: 'rgba(168, 85, 247, 0.5)', border: 'border-purple-500' };
    if (type === 'text') {
        if (name.toLowerCase().includes('main') || name.toLowerCase().includes('headline')) return { bg: 'rgba(59, 130, 246, 0.6)', border: 'border-blue-500' };
        return { bg: 'rgba(71, 85, 105, 0.5)', border: 'border-slate-400' };
    }
    return { bg: 'rgba(100, 116, 139, 0.4)', border: 'border-slate-500' };
  };

  return (
    <div className="bg-slate-900 rounded-3xl border border-white/5 overflow-hidden flex flex-col mt-4 shadow-2xl backdrop-blur-md">
       <div className="bg-slate-800/80 px-6 py-4 border-b border-white/5 flex justify-between items-center">
           <div className="flex items-center gap-4">
               <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Trình Bố Cục Studio</h4>
               <div className="flex items-center bg-slate-950 rounded-xl border border-white/5 p-1">
                   <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 hover:bg-slate-800 text-slate-400 disabled:opacity-20 border-r border-white/5 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></button>
                   <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="p-2 hover:bg-slate-800 text-slate-400 disabled:opacity-20 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></button>
               </div>
           </div>
           <div className="text-[10px] text-[#FFD300] bg-slate-950/50 px-3 py-1.5 rounded-full font-black border border-[#FFD300]/20">{layout.canvas_ratio}</div>
       </div>

       <div className="p-10 flex justify-center bg-slate-950/20 relative min-h-[400px]">
          <div ref={containerRef} className="relative w-full max-w-[450px] bg-slate-950 border border-white/10 rounded-xl shadow-2xl overflow-hidden" style={{ aspectRatio: layout.canvas_ratio.replace(':', '/') }}>
             {elements.map((el) => {
                const theme = getElementTheme(el.type, el.name);
                return (
                  <div 
                      key={el.id} 
                      onMouseDown={(e) => handleMouseDown(e, el.id, 'move')} 
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, el.id)}
                      className={`absolute flex flex-col items-center justify-center text-center cursor-move select-none group border-2 transition-all ${el.id === selectedId ? 'z-10 border-white ring-8 ring-white/10' : `z-0 ${theme.border}`}`} 
                      style={{ left: `${el.rect.x}%`, top: `${el.rect.y}%`, width: `${el.rect.width}%`, height: `${el.rect.height}%`, backgroundColor: el.image ? 'transparent' : theme.bg }}
                  >
                      {el.image ? (
                          <img src={el.image} alt="asset" className="w-full h-full object-cover pointer-events-none opacity-90 rounded-sm" />
                      ) : (
                          <div className="p-2 pointer-events-none flex flex-col items-center">
                              <span className="text-[10px] font-black text-white uppercase tracking-tighter drop-shadow-lg leading-tight line-clamp-2">{el.name}</span>
                              <div className="px-2 py-0.5 bg-black/50 rounded-full mt-2 border border-white/10">
                                <span className="text-[7px] text-white/90 font-black uppercase tracking-[0.15em]">{getElementLabel(el.type, el.name)}</span>
                              </div>
                          </div>
                      )}
                      
                      <div onMouseDown={(e) => handleMouseDown(e, el.id, 'resize')} className="absolute bottom-0 right-0 w-10 h-10 cursor-se-resize flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 z-20">
                          <div className="w-4 h-4 bg-white rounded-full shadow-2xl border-2 border-slate-900 transition-transform hover:scale-125"></div>
                      </div>
                  </div>
                );
             })}
          </div>
       </div>
       
       <div className="bg-slate-800/80 px-8 py-5 flex flex-wrap gap-6 justify-between items-center border-t border-white/5">
           <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/20"></div>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Chủ thể</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-lg shadow-blue-500/20"></div>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Nội dung</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full shadow-lg shadow-yellow-500/20"></div>
                <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Logo</span>
              </div>
           </div>
           <button onClick={() => onConfirm(generateCleanMask())} className="bg-[#FFD300] hover:bg-[#FFC000] text-black text-[10px] px-10 py-3 rounded-2xl font-black uppercase tracking-[0.1em] shadow-xl shadow-[#FFD300]/10 transition-all active:scale-95 border-t border-white/20">Xác Nhận & Đồng bộ Prompt</button>
       </div>
    </div>
  );
};

export default LayoutEditor;
