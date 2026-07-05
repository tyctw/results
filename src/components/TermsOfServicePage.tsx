import React, { useEffect } from 'react';
import { FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermsOfServicePage() {
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
      <div className="bg-amber-200 border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-900/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center shadow-[4px_4px_0_0_rgba(255,255,255,0.5)]">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">服務條款</h1>
            <p className="text-slate-800 font-bold text-sm tracking-widest uppercase mt-1">Terms of Service</p>
          </div>
        </div>
      </div>

      <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 sm:p-8 text-slate-800 space-y-8 leading-relaxed font-bold">
        <div className="bg-slate-50 p-4 sm:p-6 border-4 border-slate-900">
          <p className="text-slate-700 text-sm sm:text-base leading-loose">
            歡迎使用「全國高級中等學校免試入學分發結果查詢系統」（以下簡稱「本系統」）。本系統由「TW會考落點分析」團隊提供，旨在協助使用者透過解析榜單資料，快速查詢分發結果。當您使用本系統時，即表示您已閱讀、瞭解並同意接受本服務條款之所有內容。
          </p>
        </div>
        
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-[2px_2px_0_0_rgba(203,213,225,1)]">1</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">服務內容與限制</h3>
          </div>
          <ul className="list-none space-y-4 pl-4 sm:pl-11">
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              本系統提供使用者解析及查詢經由公開管道取得之免試入學榜單資料。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              本系統不保證服務之穩定性、無誤性及不中斷，可能因設備保養、維修、網路異常或不可抗力因素而暫停服務。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              我們保留隨時修改、暫停或永久停止提供本系統全部或部分功能之權利，且不對使用者或任何第三方承擔責任。
            </li>
          </ul>
        </section>
        
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-[2px_2px_0_0_rgba(203,213,225,1)]">2</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">使用者行為規範</h3>
          </div>
          <p className="pl-4 sm:pl-11 mb-4 text-slate-700">您同意並保證不會利用本系統從事以下行為：</p>
          <ul className="list-none space-y-4 pl-4 sm:pl-11">
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-red-500 before:border-2 before:border-slate-900">
              違反中華民國法律或任何適用的國際法規。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-red-500 before:border-2 before:border-slate-900">
              干擾、破壞本系統之伺服器或網路連線，或使用自動化程式（如爬蟲）大量擷取系統資料。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-red-500 before:border-2 before:border-slate-900">
              將本系統提供之資料用於未經授權之商業用途、惡意攻擊、騷擾他人或侵害他人隱私。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-red-500 before:border-2 before:border-slate-900">
              上傳含有惡意程式碼、病毒或意圖破壞系統之檔案。
            </li>
          </ul>
        </section>
        
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-[2px_2px_0_0_rgba(203,213,225,1)]">3</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">資料所有權與授權</h3>
          </div>
          <ul className="list-none space-y-4 pl-4 sm:pl-11">
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              使用者上傳之榜單檔案，其著作權歸原發布單位所有，本系統僅作為工具提供文字解析與搜尋服務，不主張對該資料之任何權利。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              當您將資料上傳至本系統，即代表您同意並授權本系統將該資料進行結構化處理、儲存，並開放予公眾查詢。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              本系統之程式碼、設計、介面及標誌等，其智慧財產權均屬「TW會考落點分析」團隊所有，未經書面授權不得任意使用。
            </li>
          </ul>
        </section>
        
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-[2px_2px_0_0_rgba(203,213,225,1)]">4</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">條款之修正與終止</h3>
          </div>
          <p className="pl-4 sm:pl-11 text-slate-700 leading-relaxed">
            我們保留隨時修改本條款之權利，修改後之條款將直接公告於網站，不另行通知。若您於條款修改後繼續使用本系統，視為已同意該修改。若您不同意修改後之條款，請立即停止使用本系統。
          </p>
        </section>
      </div>
    </div>
  );
}
