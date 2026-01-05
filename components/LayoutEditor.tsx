
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
  
  // Undo/Redo History State
  const [history, setHistory] = useState<LayoutElement[][]>([layout.elements]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  // Sync if prop changes (External AI update vs Internal update)
  useEffect(() => {
    const currentHistoryHead = JSON.stringify(history[historyIndex]);
    const incomingLayout = JSON.stringify(layout.elements);

    if (currentHistoryHead !== incomingLayout) {
        setElements(layout.elements);
        setHistory([layout.elements]);
        setHistoryIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]); 

  // History Helpers
  const addToHistory = (newElements: LayoutElement[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newElements))); // Deep copy
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

  // Keyboard Shortcuts
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
              e.preventDefault();
              if (e.shiftKey) {
                  handleRedo();
              } else {
                  handleUndo();
              }
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
                      return {
                          ...el,
                          image: src,
                          imageRatio: imageRatio,
                          rect: {
                              ...el.rect,
                              height: Math.min(100, newHeight)
                          }
                      };
                  });
                  
                  setElements(updatedElements);
                  addToHistory(updatedElements);
                  onLayoutChange({ ...layout, elements: updatedElements });
              };
          }
      };
      reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); 
  };

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
            return {
                ...el, 
                rect: { 
                    ...el.rect, 
                    width: newWidth, 
                    height: newHeight 
                }
            };
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

  /**
   * Generates a clean segmentation mask for the Gemini API.
   * This draws ONLY solid colored blocks on a pure black background.
   * NO text, NO borders, NO UI elements.
   */
  const generateCleanMask = (): string => {
      const canvas = document.createElement('canvas');
      // High-res internal representation for cleaner masking
      const width = 1024; 
      const [wRatio, hRatio] = layout.canvas_ratio.split(':').map(Number);
      const ratio = (wRatio && hRatio) ? wRatio / hRatio : 1;
      const height = Math.round(width / ratio);
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      // 1. Fill base background as pure black (empty space)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw each element as a solid colored block
      // The color itself is used by the model to identify the entity type
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

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden flex flex-col mt-4">
       <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
           <div className="flex items-center gap-2">
               <h4 className="text-sm font-bold text-slate-300">Trình Chỉnh Sửa Bố Cục</h4>
               <div className="flex items-center bg-slate-900 rounded border border-slate-700 ml-2">
                   <button 
                     onClick={handleUndo} 
                     disabled={historyIndex === 0}
                     className="p-1 hover:bg-slate-700 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors border-r border-slate-700"
                     title="Hoàn tác (Ctrl+Z)"
                   >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                       </svg>
                   </button>
                   <button 
                     onClick={handleRedo} 
                     disabled={historyIndex === history.length - 1}
                     className="p-1 hover:bg-slate-700 text-slate-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                     title="Làm lại (Ctrl+Y)"
                   >
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                       </svg>
                   </button>
               </div>
           </div>
           <div className="text-[10px] text-slate-500 bg-slate-950 px-2 py-1 rounded">Tỷ lệ: {layout.canvas_ratio}</div>
       </div>

       <div className="p-6 flex justify-center bg-slate-950 relative">
          <div ref={containerRef} className="relative w-full max-w-[400px] bg-white/5 border border-slate-700 rounded shadow-2xl overflow-hidden" style={{ aspectRatio: layout.canvas_ratio.replace(':', '/') }}>
             {elements.map((el) => (
                <div 
                    key={el.id} 
                    onMouseDown={(e) => handleMouseDown(e, el.id, 'move')} 
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, el.id)}
                    className={`absolute flex flex-col items-center justify-center text-center cursor-move select-none group border overflow-hidden ${el.id === selectedId ? 'z-10 ring-1 ring-white' : 'z-0 border-transparent'}`} 
                    style={{ left: `${el.rect.x}%`, top: `${el.rect.y}%`, width: `${el.rect.width}%`, height: `${el.rect.height}%`, backgroundColor: el.image ? 'transparent' : `${el.color}90` }}
                >
                    {el.image ? (
                        <img src={el.image} alt="asset" className="w-full h-full object-cover pointer-events-none opacity-80" />
                    ) : (
                        <div className="p-1 pointer-events-none">
                            <span className="text-[9px] font-bold text-white drop-shadow-md">{el.name}</span>
                            <div className="text-[7px] text-slate-300 opacity-60 mt-0.5">(Kéo ảnh vào đây)</div>
                        </div>
                    )}
                    
                    <div onMouseDown={(e) => handleMouseDown(e, el.id, 'resize')} className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-0.5 opacity-0 group-hover:opacity-100 z-20">
                        <div className="w-2.5 h-2.5 bg-white border border-slate-500 rounded-sm"></div>
                    </div>
                    
                    {el.imageRatio && (
                        <div className="absolute top-0 right-0 p-0.5 bg-black/50 rounded-bl">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-2 w-2 text-white/70" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </div>
             ))}
          </div>
       </div>
       
       <div className="bg-slate-800 px-4 py-3 flex flex-wrap gap-2 justify-between items-center border-t border-slate-700">
           <span className="text-[10px] text-slate-400">Kéo thả ảnh vào box để khóa tỷ lệ • Kéo góc để đổi kích thước</span>
           <div className="flex gap-2">
               <button 
                 onClick={() => onUpdateDescription({ ...layout, elements })}
                 disabled={isUpdatingDescription}
                 className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1 disabled:opacity-50"
               >
                 {isUpdatingDescription ? '...' : '1. Cập nhật mô tả bố cục (Mục 1)'}
               </button>
               <button 
                 onClick={() => onConfirm(generateCleanMask())}
                 className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1"
                 title="Tạo mask sạch (Chỉ màu, không chữ/viền) để gửi AI"
               >
                 2. Xác nhận & Lưu Mask
               </button>
           </div>
       </div>
    </div>
  );
};

export default LayoutEditor;
