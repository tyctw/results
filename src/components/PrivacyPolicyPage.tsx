import React, { useEffect } from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in duration-300 mb-12">
      <div className="flex items-center gap-4 mb-2">
        <Link 
          to="/"
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] font-bold text-slate-900 transition-all active:scale-95 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> 返回查詢頁面
        </Link>
      </div>
      <div className="bg-emerald-200 border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-900/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center shadow-[4px_4px_0_0_rgba(255,255,255,0.5)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">隱私權政策</h1>
            <p className="text-slate-800 font-bold text-sm tracking-widest uppercase mt-1">Privacy Policy</p>
          </div>
        </div>
      </div>

      <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 sm:p-8 text-slate-800 space-y-8 leading-relaxed font-bold">
        <div className="bg-slate-50 p-4 sm:p-6 border-4 border-slate-900">
          <p className="text-slate-700 text-sm sm:text-base leading-loose">
            隱私權保護政策內容，包括本網站（「TW會考落點分析」團隊開發之全國高級中等學校免試入學分發結果查詢網站）如何處理在您使用網站服務時收集到的個人識別資料。隱私權保護政策不適用於本網站以外的相關連結網站，也不適用於非本網站所委託或參與管理的人員。
          </p>
        </div>
        
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-[2px_2px_0_0_rgba(203,213,225,1)]">1</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">資料蒐集與利用</h3>
          </div>
          <ul className="list-none space-y-4 pl-4 sm:pl-11">
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              <span className="text-slate-900 font-black">資料收集範圍：</span>當您造訪本網站或使用本網站提供之功能（例如上傳榜單 PDF 檔案或貼上文字）時，我們將視該服務功能性質，收集必要的資料（如榜單內的准考證號、姓名等資訊）。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              <span className="text-slate-900 font-black">自動收集之資料：</span>於一般瀏覽時，伺服器會自行記錄相關行徑，包括 IP 位址、使用時間、使用的瀏覽器、瀏覽及點選資料記錄等，做為我們增進服務的參考依據。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              <span className="text-slate-900 font-black">資料利用目的：</span>收集的榜單資訊僅為提供使用者查詢落點及榜單資料之學術與數據分析用途，絕對不會將含有個人識別資訊的資料出售、交換或出租給第三方商業機構。
            </li>
          </ul>
        </section>
        
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-[2px_2px_0_0_rgba(203,213,225,1)]">2</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">資料安全保護</h3>
          </div>
          <ul className="list-none space-y-4 pl-4 sm:pl-11">
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-emerald-500 before:border-2 before:border-slate-900">
              本網站主機均設有各項資訊安全設備及必要的安全防護措施，加以保護網站及您的個人資料。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-emerald-500 before:border-2 before:border-slate-900">
              我們採用安全連線機制及資料庫存取限制，以防止未經授權的存取、竄改、披露或毀損。
            </li>
          </ul>
        </section>
        
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-[2px_2px_0_0_rgba(203,213,225,1)]">3</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">第三方連結與共用政策</h3>
          </div>
          <p className="pl-4 sm:pl-11 mb-4 text-slate-700">本網站絕不會提供任何您的個人資料給私人企業，但有以下情形除外：</p>
          <ul className="list-none space-y-4 pl-4 sm:pl-11">
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              經由您書面同意，或法律明文規定。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              為免除您生命、身體、自由或財產上之危險。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              本網站的網頁可能提供其他網站的連結，但該連結不適用本網站的隱私權政策，請您參考該連結網站之聲明。
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
