import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Menu, X, School, ExternalLink, Mail, Search } from 'lucide-react';
import ShareModal from './ShareModal';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const menuLinks = [
    { name: '各區查榜', url: 'https://tyctw.github.io/front/' },
    { name: '錄取分享', url: 'https://tyctw.github.io/shared/' },
    { name: '序位分享', url: 'https://tyctw.github.io/score/' },
  ];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, action?: () => void) => {
    if (window.hasUnsavedData) {
      const confirmLeave = window.confirm('您有尚未儲存的解析資料，確定要離開嗎？資料將會遺失。');
      if (!confirmLeave) {
        e.preventDefault();
        return;
      }
    }
    if (action) action();
  };

  return (
    <div className="min-h-screen bg-dot-pattern text-slate-900 font-sans flex flex-col selection:bg-blue-200 selection:text-slate-900 relative overflow-hidden">
      <header className="bg-amber-400 border-b-4 border-slate-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <a href="/results/" onClick={(e) => handleLinkClick(e)} className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-900 flex items-center justify-center -skew-x-6 shrink-0">
              <span className="text-white font-black text-sm sm:text-lg skew-x-6 tracking-tighter">115</span>
            </div>
            <span className="text-base sm:text-xl font-black tracking-tight text-slate-900 truncate">會考姓名查榜</span>
          </a>
          <nav className="flex items-center gap-3">
            <button 
              onClick={() => setIsShareOpen(true)}
              aria-label="分享"
              className="p-2 border-2 border-slate-900 bg-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 transition-all flex items-center justify-center"
              title="分享"
            >
              <Share2 className="w-5 h-5 text-slate-900" />
            </button>
            <button 
              onClick={() => setIsMenuOpen(true)} 
              aria-label="開啟選單"
              className="p-2 border-2 border-slate-900 bg-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 transition-all flex items-center justify-center"
            >
              <Menu className="w-5 h-5 text-slate-900" />
            </button>
          </nav>
        </div>
        
        {/* Menu Drawer */}
        {isMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 animate-in fade-in duration-300"
            onClick={() => setIsMenuOpen(false)}
          >
            <div 
              role="dialog" 
              aria-modal="true" 
              aria-labelledby="menu-title"
              className="absolute top-0 right-0 h-full w-[80vw] max-w-sm bg-white border-l-4 border-slate-900 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b-4 border-slate-900 flex justify-between items-center bg-slate-100">
                <span id="menu-title" className="font-black text-slate-900 text-lg">選單</span>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="關閉選單"
                  className="p-2 border-2 border-slate-900 bg-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 transition-all flex items-center justify-center active:scale-95"
                >
                  <X className="w-5 h-5 text-slate-900" />
                </button>
              </div>
              <div className="flex flex-col p-6 gap-4 overflow-y-auto bg-amber-50 flex-grow">
                <Link 
                  to="/"
                  onClick={(e) => handleLinkClick(e, () => setIsMenuOpen(false))}
                  className="p-4 text-lg font-black border-4 border-slate-900 bg-white hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-2 transition-colors shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex items-center gap-4 text-left w-full active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
                >
                  <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center -skew-x-6">
                    <Search className="w-5 h-5 skew-x-6" />
                  </div>
                  榜單查詢
                </Link>
                
                <Link 
                  to="/schools"
                  onClick={(e) => handleLinkClick(e, () => setIsMenuOpen(false))}
                  className="p-4 text-lg font-black border-4 border-slate-900 bg-white hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-2 transition-colors shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex items-center gap-4 text-left w-full active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
                >
                  <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center -skew-x-6">
                    <School className="w-5 h-5 skew-x-6" />
                  </div>
                  收錄學校
                </Link>
                
                <Link 
                  to="/admin"
                  onClick={(e) => handleLinkClick(e, () => setIsMenuOpen(false))}
                  className="p-4 text-lg font-black border-4 border-slate-900 bg-white hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-2 transition-colors shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex items-center gap-4 text-left w-full active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
                >
                  <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center -skew-x-6">
                    <span className="font-black skew-x-6">管</span>
                  </div>
                  管理員後台
                </Link>
                
                {menuLinks.map((link) => (
                  <a 
                    key={link.name} 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-4 text-lg font-black border-4 border-slate-900 bg-white hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-2 transition-colors shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex items-center justify-between active:translate-y-[2px] active:translate-x-[2px] active:shadow-none group"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span className="flex items-center gap-4">
                      <div className="w-2 h-8 bg-slate-900 -skew-x-6 group-hover:bg-amber-500 transition-colors" />
                      {link.name}
                    </span>
                    <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-slate-900 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className=" p-4 md:p-8 flex justify-center items-start flex-grow">
        {children}
      </main>

      <footer className=" bg-slate-900 border-t-4 border-slate-900 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p className="text-sm font-bold text-slate-100">© {new Date().getFullYear()} 全國會考榜單查詢 <span className="text-amber-400">(非官方網站)</span></p>
            <a href="mailto:tyctw.analyze@gmail.com" className="text-xs font-bold text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors flex items-center gap-1.5 mt-0.5 w-fit">
              <Mail className="w-3.5 h-3.5" /> tyctw.analyze@gmail.com
            </a>
          </div>
          <div className="flex items-center gap-6">
            <Link 
              to="/privacy"
              className="text-sm font-bold text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors underline decoration-2 underline-offset-4"
              onClick={(e) => handleLinkClick(e)}
            >
              隱私權政策
            </Link>
            <Link 
              to="/terms"
              className="text-sm font-bold text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors underline decoration-2 underline-offset-4"
              onClick={(e) => handleLinkClick(e)}
            >
              服務條款
            </Link>
            <Link 
              to="/disclaimer"
              className="text-sm font-bold text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors underline decoration-2 underline-offset-4"
              onClick={(e) => handleLinkClick(e)}
            >
              免責聲明
            </Link>
          </div>
        </div>
      </footer>

      <ShareModal isOpen={isShareOpen} onClose={() => setIsShareOpen(false)} />
    </div>
  );
}
