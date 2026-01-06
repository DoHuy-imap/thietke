
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
    onConfirm 
}) => {
  const [elements, setElements] = useState<LayoutElement[]>(layout.elements);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // History Management
  const [history, setHistory] = useState<LayoutElement[][]>([layout.elements]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [activeAction, setActiveAction] = useState<{ id: string, type: 'move' | 'resize' } | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  
  useEffect(() => {
    // Sync with external prop changes, but carefully to not break local history if it's just a confirm
    if (JSON.stringify(history[0]) !== JSON.stringify(layout.elements)) {
        setElements(layout.elements);
        setHistory([layout.elements]);
        setHistoryIndex(0);
    }
  }, [layout.elements]); // Only reset if layout.elements prop deeply changes (new generation)

  const addToHistory = (newElements: LayoutElement[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newElements)));
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
      if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setElements(JSON.parse(JSON.stringify(history[newIndex])));
          onLayoutChange({ ...layout, elements: history[newIndex] });
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setElements(JSON.parse(JSON.stringify(history[newIndex])));
          onLayoutChange({ ...layout, elements: history[newIndex] });
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
                    const [wR, hR] = layout.canvas_ratio.split(':').map(Number);
                    const canvasRatio = wR / hR;
                    newHeight = (newWidth * canvasRatio) / el.imageRatio;
                }
                return { ...el, rect: { ...el.rect, width: newWidth, height: newHeight } };
            }
        }));
    });
  }, [activeAction, layout.canvas_ratio]);

  const handleMouseUp = useCallback(() => {
    if (activeAction) {
      setActiveAction(null);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      addToHistory(elements);
      onLayoutChange({ ...layout, elements });
    }
  }, [activeAction, elements, layout, onLayoutChange, historyIndex, history]); // Added deps

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
      const [wRatio, hRatio] = layout.canvas_ratio.split(':').map(Number);
      const height = Math.round(width / (wRatio / hRatio));
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
    if (type === 'subject') return { bg: 'rgba(16, 185, 129, 0.5)', border: 'border-emerald-500', text: 'text-emerald-400' };
    if (type === 'logo') return { bg: 'rgba(234, 179, 8, 0.5)', border: 'border-yellow-500', text: 'text-yellow-400' };
    if (type === 'decor') return { bg: 'rgba(168, 85, 247, 0.5)', border: 'border-purple-500', text: 'text-purple-400' };
    if (type === 'text') {
        if (name.toLowerCase().includes('main')) return { bg: 'rgba(59, 130, 246, 0.6)', border: 'border-blue-500', text: 'text-blue-400' };
        return { bg: 'rgba(71, 85, 105, 0.5)', border: 'border-slate-400', text: 'text-slate-400' };
    }
    return { bg: 'rgba(100, 116, 139, 0.4)', border: 'border-slate-500', text: 'text-slate-500' };
  };

  return (
    <div className="bg-slate-900 rounded-3xl border border-white/5 overflow-hidden flex flex-col mt-4 shadow-2xl backdrop-blur-md">
       <div className="bg-slate-800/80 px-6 py-4 border-b border-white/5 flex justify-between items-center">
           <div className="flex items-center gap-4">
               <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Trình Bố Cục Studio</h4>
               <div className="flex gap-2">
                   <button 
                       onClick={handleUndo} 
                       disabled={historyIndex === 0}
                       className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                       title="Hoàn tác (Undo)"
                   >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                   </button>
                   <button 
                       onClick={handleRedo} 
                       disabled={historyIndex === history.length - 1}
                       className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-white hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                       title="Làm lại (Redo)"
                   >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                   </button>
               </div>
           </div>
           <div className="text-[10px] text-[#FFD300] bg-slate-950/50 px-3 py-1.5 rounded-full font-black border border-[#FFD300]/20">{layout.canvas_ratio}</div>
       </div>

       <div className="flex flex-col md:flex-row h-[500px]">
           {/* Canvas Area */}
           <div className="flex-1 p-10 flex justify-center bg-slate-950/20 relative overflow-hidden">
                <div ref={containerRef} className="relative w-full max-w-[450px] bg-slate-950 border border-white/10 rounded-xl shadow-2xl overflow-hidden self-center" style={{ aspectRatio: layout.canvas_ratio.replace(':', '/') }}>
                    {elements.map((el) => {
                        const theme = getElementTheme(el.type, el.name);
                        return (
                        <div 
                            key={el.id} 
                            onMouseDown={(e) => handleMouseDown(e, el.id, 'move')} 
                            className={`absolute flex flex-col items-center justify-center text-center cursor-move select-none group border-2 transition-shadow duration-300 ${el.id === selectedId ? 'z-20 border-white ring-8 ring-white/10' : `z-10 ${theme.border}`}`} 
                            style={{ left: `${el.rect.x}%`, top: `${el.rect.y}%`, width: `${el.rect.width}%`, height: `${el.rect.height}%`, backgroundColor: el.image ? 'transparent' : theme.bg }}
                        >
                            {el.image ? <img src={el.image} alt="asset" className="w-full h-full object-cover pointer-events-none opacity-90 rounded-sm" /> : (
                                <div className="p-2 pointer-events-none flex flex-col items-center">
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter drop-shadow-lg line-clamp-2">{el.name}</span>
                                    <div className="px-2 py-0.5 bg-black/50 rounded-full mt-2 border border-white/10"><span className="text-[7px] text-white/90 font-black uppercase tracking-widest">{el.type}</span></div>
                                </div>
                            )}
                            {el.id === selectedId && (
                                <div onMouseDown={(e) => handleMouseDown(e, el.id, 'resize')} className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize flex items-end justify-end p-1.5 z-30"><div className="w-3 h-3 bg-white rounded-full shadow-lg border-2 border-slate-900" /></div>
                            )}
                        </div>
                        );
                    })}
                </div>
           </div>

           {/* Layer List Panel */}
           <div className="w-full md:w-64 bg-slate-950 border-l border-white/5 flex flex-col">
               <div className="p-3 border-b border-white/5 bg-slate-900/50">
                   <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Danh sách lớp (Layers)</h5>
               </div>
               <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
                   {[...elements].reverse().map((el) => {
                       const theme = getElementTheme(el.type, el.name);
                       return (
                           <div 
                               key={el.id} 
                               onClick={() => setSelectedId(el.id)}
                               className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center gap-3 group ${el.id === selectedId ? 'bg-slate-800 border-white/30 shadow-lg' : 'bg-slate-900/50 border-transparent hover:bg-slate-800 hover:border-white/10'}`}
                           >
                               <div className={`w-3 h-3 rounded-full ${theme.text.replace('text-', 'bg-')} shadow-[0_0_8px_currentColor]`}></div>
                               <div className="flex-1 min-w-0">
                                   <p className={`text-[10px] font-bold truncate ${el.id === selectedId ? 'text-white' : 'text-slate-400'}`}>{el.name}</p>
                                   <p className="text-[8px] text-slate-600 uppercase font-black tracking-wider">{el.type}</p>
                               </div>
                               {el.id === selectedId && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                           </div>
                       )
                   })}
               </div>
           </div>
       </div>
       
       <div className="bg-slate-800/80 px-8 py-5 flex justify-end border-t border-white/5">
           <button onClick={() => onConfirm(generateCleanMask())} className="bg-[#FFD300] hover:bg-[#FFC000] text-black text-[10px] px-10 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 border-t border-white/20">Xác Nhận Bố Cục</button>
       </div>
    </div>
  );
};

export default LayoutEditor;
