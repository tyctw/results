import React from 'react';
import { X, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareModal({ isOpen, onClose }: ShareModalProps) {
  const [copied, setCopied] = React.useState(false);
  
  if (!isOpen) return null;

  const url = window.location.href;
  const title = "全國會考榜單查詢";

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLinks = {
    line: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    threads: `https://threads.net/intent/post?text=${encodeURIComponent(title + " " + url)}`,
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="bg-white border-4 border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] w-full max-w-sm overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 sm:p-5 border-b-4 border-slate-900 bg-slate-100 shrink-0">
          <h2 id="share-title" className="text-xl font-black text-slate-900 tracking-tight">分享連結</h2>
          <button onClick={onClose} aria-label="關閉" className="p-2 border-2 border-slate-900 bg-white hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 transition-colors shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center gap-6 overflow-y-auto">
          <div className="bg-white p-2 border-4 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
            <QRCodeSVG value={url} size={180} level="H" includeMargin={false} />
          </div>
          
          <div className="w-full flex border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] overflow-hidden">
            <div className="flex-1 px-3 py-2 bg-slate-50 border-r-2 border-slate-900 truncate text-sm font-bold text-slate-600 flex items-center">
              {url}
            </div>
            <button 
              onClick={handleCopy}
              className="px-4 py-2 bg-slate-900 text-white font-black hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-inset transition-colors flex items-center justify-center gap-2 min-w-[80px]"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? '已複製' : '複製'}
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-3 w-full">
            <a 
              href={shareLinks.line} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-2 p-3 bg-[#06C755] text-white border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] transition-all font-black"
            >
              LINE
            </a>
            <a 
              href={shareLinks.facebook} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-2 p-3 bg-[#1877F2] text-white border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] transition-all font-black"
            >
              FB
            </a>
            <a 
              href={shareLinks.threads} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-2 p-3 bg-black text-white border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] transition-all font-black"
            >
              Threads
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
