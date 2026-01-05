
import React, { useEffect, useState } from 'react';
import { getAllDesigns, deleteDesign, clearAllDesigns } from '../services/historyDb';
import { DesignDNA } from '../types';
import SmartRemover from './SmartRemover';
import { removeObjectWithMask, upscaleImageTo4K } from '../services/geminiService';

const GalleryView: React.FC = () => {
  const [designs, setDesigns] = useState<DesignDNA[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDesign, setSelectedDesign] = useState<DesignDNA | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editResult, setEditResult] = useState<string | null>(null);
  const [isProcessingEdit, setIsProcessingEdit] = useState(false);
  const [isUpscalingEdit, setIsUpscalingEdit] = useState(false);

  const fetchDesigns = async () => {
    setLoading(true);
    const data = await getAllDesigns();
    setDesigns(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDesigns();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (!id) return;
    if (window.confirm("Bạn có chắc chắn muốn xóa thiết kế này vĩnh viễn?")) {
      await deleteDesign(id);
      fetchDesigns(); 
      if (selectedDesign?.id === id) setSelectedDesign(null);
    }
  };

  const handleClearAll = async () => {
    if (designs.length === 0) return;
    if (window.confirm("CẢNH BÁO: Hành động này sẽ xóa TOÀN BỘ lịch sử thiết kế trong thư viện. Bạn có chắc chắn muốn tiếp tục?")) {
      await clearAllDesigns();
      fetchDesigns();
      setSelectedDesign(null);
    }
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };
  
  const getAspectRatioStyle = (ratioStr: string) => {
      const [w, h] = ratioStr.split(':');
      if (w && h) {
          return { aspectRatio: `${w}/${h}` };
      }
      return { aspectRatio: '3/4' }; 
  };

  const handleCloseModal = () => {
      setSelectedDesign(null);
      setEditResult(null);
      setIsEditing(false);
  };

  const handleSmartRemove = async (maskBase64: string, textDescription: string) => {
      if (!selectedDesign) return;
      
      setIsProcessingEdit(true);
      try {
          const result = await removeObjectWithMask(selectedDesign.thumbnail, maskBase64, textDescription);
          if (result) {
              setEditResult(result);
              setIsEditing(false);
          } else {
              alert("Không thể xóa vật thể. Vui lòng thử lại.");
          }
      } catch (error) {
          console.error("Magic erase failed:", error);
          alert("Lỗi khi xử lý hình ảnh.");
      } finally {
          setIsProcessingEdit(false);
      }
  };

  const handleDownloadEdited4K = async () => {
      if (!editResult || !selectedDesign) return;
      
      setIsUpscalingEdit(true);
      try {
          const ratio = selectedDesign.recommendedAspectRatio || selectedDesign.layout.canvas_ratio || "1:1";
          const upscaleUrl = await upscaleImageTo4K(editResult, ratio as any);
          
          const link = document.createElement('a');
          link.href = upscaleUrl;
          link.download = `edited-design-4k-${Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (error) {
          console.error("Upscale failed:", error);
          alert("Không thể nâng cấp ảnh lên 4K.");
      } finally {
          setIsUpscalingEdit(false);
      }
  };

  return (
    <div className="h-full overflow-y-auto pr-2 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Thư Viện Thiết Kế
        </h2>
        <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400 font-medium">{designs.length} mẫu đã lưu</span>
            {designs.length > 0 && (
                <button 
                  onClick={handleClearAll}
                  className="text-xs text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded border border-red-500/30 hover:bg-red-900/10 transition-colors"
                >
                  Xóa tất cả lịch sử
                </button>
            )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
           <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {!loading && designs.length === 0 && (
        <div className="flex flex-col items-center justify-center h-96 bg-slate-800/30 rounded-2xl border border-slate-700/50 border-dashed">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-slate-400 text-sm">Chưa có thiết kế nào được lưu.</p>
          <p className="text-slate-500 text-xs mt-1">Hãy tạo ảnh và lưu lại từ màn hình kết quả.</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {designs.map((design) => (
          <div 
            key={design.id} 
            onClick={() => setSelectedDesign(design)}
            className="group relative bg-slate-900 rounded-xl overflow-hidden border border-slate-700 hover:border-purple-500 transition-all cursor-pointer shadow-lg hover:shadow-purple-900/20 flex flex-col"
          >
            <div 
                className="w-full overflow-hidden bg-slate-950 relative"
                style={getAspectRatioStyle(design.recommendedAspectRatio || design.layout.canvas_ratio)}
            >
               <img src={design.thumbnail} alt="Design" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                  <span className="text-white text-xs font-bold line-clamp-2">{design.requestData.mainHeadline}</span>
               </div>
            </div>
            
            <div className="p-3 bg-slate-800 border-t border-slate-700 flex-grow-0">
               <div className="flex justify-between items-center mb-1">
                   <span className="text-[10px] text-purple-300 font-medium px-2 py-0.5 bg-purple-900/30 rounded border border-purple-500/20 truncate max-w-[70%]">{design.requestData.productType}</span>
                   <button 
                      onClick={(e) => handleDelete(e, design.id)}
                      className="text-slate-500 hover:text-red-400 p-1 rounded-full hover:bg-slate-700 transition-colors"
                      title="Xóa"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                   </button>
               </div>
               <p className="text-[10px] text-slate-500">{formatDate(design.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {selectedDesign && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleCloseModal}>
           <div className="bg-slate-900 w-full max-w-5xl h-[85vh] rounded-2xl border border-slate-700 flex overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="w-1/2 bg-slate-950 flex items-center justify-center p-8 relative border-r border-slate-800">
                   <div className="relative w-full h-full flex items-center justify-center">
                       <img src={editResult || selectedDesign.thumbnail} className="max-w-full max-h-full object-contain shadow-2xl rounded-sm" alt="Full Design" />
                       
                       {editResult && (
                           <div className="absolute top-4 left-4 bg-purple-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-10">
                               KẾT QUẢ ĐÃ CHỈNH SỬA
                           </div>
                       )}
                   </div>
               </div>

               <div className="w-1/2 flex flex-col">
                   <div className="p-6 border-b border-slate-700 flex justify-between items-start">
                       <div>
                           <h3 className="text-xl font-bold text-white mb-1">{selectedDesign.requestData.mainHeadline}</h3>
                           <p className="text-sm text-slate-400">{selectedDesign.requestData.productType} • {selectedDesign.requestData.width}x{selectedDesign.requestData.height}cm</p>
                       </div>
                       <button onClick={handleCloseModal} className="text-slate-500 hover:text-white">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                           </svg>
                       </button>
                   </div>

                   <div className="flex-grow overflow-y-auto p-6 space-y-6">
                       <div>
                           <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Tài nguyên đã dùng</h4>
                           <div className="flex flex-wrap gap-2">
                               {selectedDesign.assets.map((asset, idx) => (
                                   <div key={idx} className="w-12 h-12 rounded border border-slate-700 bg-slate-800 overflow-hidden" title={asset.type}>
                                       <img src={asset.data} className="w-full h-full object-cover opacity-70 hover:opacity-100 transition-opacity" alt="asset" />
                                   </div>
                               ))}
                           </div>
                       </div>

                       <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                           <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Thông tin thiết kế</h4>
                           <div className="space-y-2">
                               <div className="grid grid-cols-3 gap-2 text-xs border-b border-slate-700/50 pb-2 mb-2">
                                   <span className="text-slate-500">Chủ thể:</span>
                                   <span className="col-span-2 text-slate-300">{selectedDesign.designPlan.subject}</span>
                               </div>
                               <div className="grid grid-cols-3 gap-2 text-xs">
                                   <span className="text-slate-500">Màu sắc:</span>
                                   <span className="col-span-2 text-slate-300">{selectedDesign.designPlan.colorLighting}</span>
                               </div>
                           </div>
                       </div>
                       
                       <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Công cụ chỉnh sửa</h4>
                            
                            {!editResult ? (
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="w-full py-2.5 bg-slate-800 hover:bg-red-900/20 border border-red-500/50 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 group"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Xóa chi tiết (Magic Erase)
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setEditResult(null)}
                                    className="w-full py-2.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-sm font-medium hover:text-white transition-all"
                                >
                                    Hủy chỉnh sửa / Quay lại ảnh gốc
                                </button>
                            )}
                       </div>
                   </div>

                   <div className="p-6 border-t border-slate-700 bg-slate-800/30">
                       {editResult ? (
                           <button 
                             onClick={handleDownloadEdited4K}
                             disabled={isUpscalingEdit}
                             className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-lg text-white font-bold shadow-lg shadow-purple-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                           >
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                               </svg>
                               {isUpscalingEdit ? 'Đang nâng cấp 4K...' : 'Tải về Kết quả mới (4K)'}
                           </button>
                       ) : (
                           <button className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-lg text-white font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                               </svg>
                               Tải file in 4K (Upscale)
                           </button>
                       )}
                       <p className="text-center text-[10px] text-slate-500 mt-2">Ảnh sẽ được AI nâng cấp độ phân giải tối đa trước khi tải về.</p>
                   </div>
               </div>
           </div>
        </div>
      )}

      {isEditing && selectedDesign && (
          <SmartRemover 
              imageUrl={selectedDesign.thumbnail}
              onClose={() => setIsEditing(false)}
              onProcess={handleSmartRemove}
              isProcessing={isProcessingEdit}
          />
      )}
    </div>
  );
};

export default GalleryView;
