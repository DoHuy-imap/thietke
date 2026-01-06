
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
  const [history, setHistory] = useState<LayoutElement[][]>([layout.elements]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeAction, setActiveAction] = useState<{ id: string, type: 'move' | 'resize' } | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (JSON.stringify(history[historyIndex]) !== JSON.stringify(layout.elements)) {
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
  }, [activeAction, elements, layout, onLayoutChange]);

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
    if (type === 'subject') return { bg: 'rgba(16, 185, 129, 0.5)', border: 'border-emerald-500' };
    if (type === 'logo') return { bg: 'rgba(234, 179, 8, 0.5)', border: 'border-yellow-500' };
    if (type === 'decor') return { bg: 'rgba(168, 85, 247, 0.5)', border: 'border-purple-500' };
    if (type === 'text') {
        if (name.toLowerCase().includes('main')) return { bg: 'rgba(59, 130, 246, 0.6)', border: 'border-blue-500' };
        return { bg: 'rgba(71, 85, 105, 0.5)', border: 'border-slate-400' };
    }
    return { bg: 'rgba(100, 116, 139, 0.4)', border: 'border-slate-500' };
  };

  return (
    <div className="bg-slate-900 rounded-3xl border border-white/5 overflow-hidden flex flex-col mt-4 shadow-2xl backdrop-blur-md">
       <div className="bg-slate-800/80 px-6 py-4 border-b border-white/5 flex justify-between items-center">
           <div className="flex items-center gap-4"><h4 className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Trình Bố Cục Studio</h4></div>
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
                      className={`absolute flex flex-col items-center justify-center text-center cursor-move select-none group border-2 transition-shadow duration-300 ${el.id === selectedId ? 'z-10 border-white ring-8 ring-white/10' : `z-0 ${theme.border}`}`} 
                      style={{ left: `${el.rect.x}%`, top: `${el.rect.y}%`, width: `${el.rect.width}%`, height: `${el.rect.height}%`, backgroundColor: el.image ? 'transparent' : theme.bg }}
                  >
                      {el.image ? <img src={el.image} alt="asset" className="w-full h-full object-cover pointer-events-none opacity-90 rounded-sm" /> : (
                          <div className="p-2 pointer-events-none flex flex-col items-center">
                              <span className="text-[10px] font-black text-white uppercase tracking-tighter drop-shadow-lg line-clamp-2">{el.name}</span>
                              <div className="px-2 py-0.5 bg-black/50 rounded-full mt-2 border border-white/10"><span className="text-[7px] text-white/90 font-black uppercase tracking-widest">{el.type}</span></div>
                          </div>
                      )}
                      <div onMouseDown={(e) => handleMouseDown(e, el.id, 'resize')} className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize flex items-end justify-end p-1.5 z-20"><div className="w-3 h-3 bg-white rounded-full shadow-lg border-2 border-slate-900" /></div>
                  </div>
                );
             })}
          </div>
       </div>
       
       <div className="bg-slate-800/80 px-8 py-5 flex justify-end border-t border-white/5">
           <button onClick={() => onConfirm(generateCleanMask())} className="bg-[#FFD300] hover:bg-[#FFC000] text-black text-[10px] px-10 py-3 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 border-t border-white/20">Xác Nhận Bố Cục</button>
       </div>
    </div>
  );
};

export default LayoutEditor;
