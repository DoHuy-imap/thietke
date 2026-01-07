
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
    onConfirm 
}) => {
  const [elements, setElements] = useState<LayoutElement[]>(layout.elements);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [history, setHistory] = useState<LayoutElement[][]>([JSON.parse(JSON.stringify(layout.elements))]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [activeAction, setActiveAction] = useState<{ id: string, type: 'move' | 'resize' } | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  /**
   * TÍNH TOÁN ASPECT RATIO ĐỘNG
   * Chuyển đổi chuỗi "W:H" từ layout.canvas_ratio thành số thực để áp dụng style.
   */
  const dynamicAspectRatio = useMemo(() => {
    const parts = layout.canvas_ratio.split(':');
    if (parts.length === 2) {
      const w = parseFloat(parts[0]);
      const h = parseFloat(parts[1]);
      if (!isNaN(w) && !isNaN(h) && h !== 0) {
        return w / h;
      }
    }
    return 16 / 9; // Fallback
  }, [layout.canvas_ratio]);

  const addToHistory = useCallback((newElements: LayoutElement[]) => {
      setHistory(prev => {
          const newHistory = prev.slice(0, historyIndex + 1);
          newHistory.push(JSON.parse(JSON.stringify(newElements)));
          return newHistory;
      });
      setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const handleUndo = () => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          const prevElements = JSON.parse(JSON.stringify(history[newIndex]));
          setHistoryIndex(newIndex);
          setElements(prevElements);
          onLayoutChange({ ...layout, elements: prevElements });
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          const nextElements = JSON.parse(JSON.stringify(history[newIndex]));
          setHistoryIndex(newIndex);
          setElements(nextElements);
          onLayoutChange({ ...layout, elements: nextElements });
      }
  };

  const handleMouseDown = (e: React.MouseEvent, id: string, type: 'move' | 'resize') => {
    e.stopPropagation();
    setActiveAction({ id, type });
    setSelectedId(id);
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!activeAction || !containerRef.current) return;
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    rafRef.current = requestAnimationFrame(() => {
        const containerRect = containerRef.current!.getBoundingClientRect();
        const deltaX = ((e.clientX - lastPos.current.x) / containerRect.width) * 100;
        const deltaY = ((e.clientY - lastPos.current.y) / containerRect.height) * 100;
        lastPos.current = { x: e.clientX, y: e.clientY };

        setElements(prev => prev.map(el => {
            if (el.id !== activeAction.id) return el;
            
            if (activeAction.type === 'move') {
                const newX = Math.max(0, Math.min(100 - el.rect.width, el.rect.x + deltaX));
                const newY = Math.max(0, Math.min(100 - el.rect.height, el.rect.y + deltaY));
                return { ...el, rect: { ...el.rect, x: newX, y: newY } };
            } else {
                const newWidth = Math.max(5, Math.min(100 - el.rect.x, el.rect.width + deltaX));
                let newHeight = Math.max(5, Math.min(100 - el.rect.y, el.rect.height + deltaY));
                
                if (el.imageRatio) {
                    newHeight = (newWidth * dynamicAspectRatio) / el.imageRatio;
                }
                return { ...el, rect: { ...el.rect, width: newWidth, height: newHeight } };
            }
        }));
    });
  }, [activeAction, dynamicAspectRatio]);

  const handleMouseUp = useCallback(() => {
    if (activeAction) {
      setActiveAction(null);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      addToHistory(elements);
      onLayoutChange({ ...layout, elements });
    }
  }, [activeAction, elements, layout, onLayoutChange, addToHistory]);

  useEffect(() => {
    if (activeAction) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeAction, handleMouseMove, handleMouseUp]);

  const generateCleanMask = (): string => {
      const canvas = document.createElement('canvas');
      const width = 1024; 
      const height = Math.round(width / dynamicAspectRatio);
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height);
      elements.forEach(el => {
          ctx.fillStyle = el.color; 
          ctx.fillRect((el.rect.x / 100) * width, (el.rect.y / 100) * height, (el.rect.width / 100) * width, (el.rect.height / 100) * height);
      });
      return canvas.toDataURL('image/png');
  };

  const getElementTheme = (type: string, name: string) => {
    // Tăng độ đục (opacity) của background để nhìn rõ hơn trên nền tối
    if (type === 'subject') return { bg: 'rgba(16, 185, 129, 0.6)', border: 'border-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/50' };
    if (type === 'logo') return { bg: 'rgba(234, 179, 8, 0.6)', border: 'border-yellow-500', text: 'text-yellow-400', glow: 'shadow-yellow-500/50' };
    if (type === 'decor') return { bg: 'rgba(168, 85, 247, 0.6)', border: 'border-purple-500', text: 'text-purple-400', glow: 'shadow-purple-500/50' };
    if (type === 'text') {
        if (name.toLowerCase().includes('main')) return { bg: 'rgba(59, 130, 246, 0.7)', border: 'border-blue-500', text: 'text-blue-400', glow: 'shadow-blue-500/50' };
        return { bg: 'rgba(71, 85, 105, 0.6)', border: 'border-slate-400', text: 'text-slate-400', glow: 'shadow-slate-400/50' };
    }
    return { bg: 'rgba(100, 116, 139, 0.5)', border: 'border-slate-500', text: 'text-slate-500', glow: 'shadow-slate-500/50' };
  };

  return (
    <div className="bg-slate-900 rounded-[2.5rem] border border-white/5 overflow-hidden flex flex-col mt-4 shadow-2xl backdrop-blur-xl">
       <div className="bg-slate-800/80 px-8 py-5 border-b border-white/5 flex justify-between items-center">
           <div className="flex items-center gap-6">
               <h4 className="text-[11px] font-black text-slate-200 uppercase tracking-widest flex items-center gap-3">
                   <div className="w-2 h-2 bg-[#FFD300] rounded-full animate-pulse shadow-[0_0_10px_rgba(255,211,0,0.5)]"></div>
                   Trình Bố Cục Studio
               </h4>
               <div className="flex gap-3">
                   <button 
                       onClick={handleUndo} 
                       disabled={historyIndex === 0}
                       className="p-2 rounded-xl bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-90"
                       title="Hoàn tác (Undo)"
                   >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                   </button>
                   <button 
                       onClick={handleRedo} 
                       disabled={historyIndex === history.length - 1}
                       className="p-2 rounded-xl bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 disabled:opacity-20 disabled:cursor-not-allowed transition-all active:scale-90"
                       title="Làm lại (Redo)"
                   >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                   </button>
               </div>
           </div>
           <div className="text-[11px] text-[#FFD300] bg-slate-950/80 px-4 py-2 rounded-2xl font-black border border-[#FFD300]/30 shadow-inner">
               {layout.canvas_ratio}
           </div>
       </div>

       <div className="flex flex-col md:flex-row h-[550px]">
           <div className="flex-1 p-10 flex justify-center bg-slate-950/30 relative overflow-hidden">
                <div 
                    ref={containerRef} 
                    className="relative w-full max-w-[450px] bg-slate-950 border border-white/20 rounded-2xl shadow-2xl overflow-hidden self-center group" 
                    style={{ aspectRatio: `${dynamicAspectRatio}` }}
                >
                    <div className="absolute inset-0 bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:20px_20px]"></div>
                    {elements.map((el) => {
                        const theme = getElementTheme(el.type, el.name);
                        return (
                        <div 
                            key={el.id} 
                            onMouseDown={(e) => handleMouseDown(e, el.id, 'move')} 
                            className={`absolute flex flex-col items-center justify-center text-center cursor-move select-none group border-[3px] transition-all duration-300 shadow-xl ${el.id === selectedId ? 'z-40 border-white ring-[12px] ring-white/10 scale-[1.01]' : `z-20 ${theme.border} hover:scale-[1.005] hover:z-30`}`} 
                            style={{ 
                                left: `${el.rect.x}%`, 
                                top: `${el.rect.y}%`, 
                                width: `${el.rect.width}%`, 
                                height: `${el.rect.height}%`, 
                                backgroundColor: el.image ? 'transparent' : theme.bg,
                                borderStyle: 'dashed',
                                zIndex: el.id === selectedId ? 50 : (el.type === 'subject' ? 30 : 20)
                            }}
                        >
                            {el.image ? <img src={el.image} alt="asset" className="w-full h-full object-cover pointer-events-none opacity-95 rounded-sm" /> : (
                                <div className="p-4 pointer-events-none flex flex-col items-center">
                                    <span className="text-[11px] font-black text-white uppercase tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] line-clamp-2 leading-tight">{el.name}</span>
                                    <div className="px-3 py-1 bg-black/60 rounded-full mt-3 border border-white/20 backdrop-blur-md">
                                        <span className="text-[8px] text-white/90 font-black uppercase tracking-widest">{el.type}</span>
                                    </div>
                                </div>
                            )}
                            {el.id === selectedId && (
                                <div onMouseDown={(e) => handleMouseDown(e, el.id, 'resize')} className="absolute bottom-0 right-0 w-10 h-10 cursor-se-resize flex items-end justify-end p-2 z-50">
                                    <div className="w-4 h-4 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)] border-2 border-slate-900 transition-transform hover:scale-125" />
                                </div>
                            )}
                        </div>
                        );
                    })}
                </div>
           </div>

           <div className="w-full md:w-72 bg-slate-950/80 border-l border-white/5 flex flex-col backdrop-blur-md">
               <div className="p-5 border-b border-white/5 bg-slate-900/40">
                   <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                       Danh sách lớp (Layers)
                   </h5>
               </div>
               <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-hide">
                   {[...elements].reverse().map((el) => {
                       const theme = getElementTheme(el.type, el.name);
                       return (
                           <div 
                               key={el.id} 
                               onClick={() => setSelectedId(el.id)}
                               className={`p-4 rounded-[1.5rem] border cursor-pointer transition-all flex items-center gap-4 group ${el.id === selectedId ? 'bg-slate-800 border-[#FFD300]/40 shadow-xl scale-[1.02]' : 'bg-slate-900/40 border-transparent hover:bg-slate-800/60 hover:border-white/10'}`}
                           >
                               <div className={`w-4 h-4 rounded-full ${theme.text.replace('text-', 'bg-')} shadow-[0_0_12px_currentColor] border-2 border-white/10`}></div>
                               <div className="flex-1 min-w-0">
                                   <p className={`text-[11px] font-black truncate tracking-tight ${el.id === selectedId ? 'text-white' : 'text-slate-300'}`}>{el.name}</p>
                                   <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-0.5">{el.type}</p>
                               </div>
                               {el.id === selectedId && <div className="w-2 h-2 rounded-full bg-[#FFD300] shadow-[0_0_8px_#FFD300]"></div>}
                           </div>
                       )
                   })}
               </div>
           </div>
       </div>
       
       <div className="bg-slate-800/80 px-10 py-6 flex justify-end border-t border-white/5 backdrop-blur-md">
           <button onClick={() => onConfirm(generateCleanMask())} className="bg-[#FFD300] hover:bg-[#FFC000] text-black text-[11px] px-12 py-4 rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95 border-t-2 border-white/20">Xác Nhận Bố Cục</button>
       </div>
    </div>
  );
};

export default LayoutEditor;
