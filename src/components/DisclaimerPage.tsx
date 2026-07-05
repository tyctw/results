import React, { useEffect } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DisclaimerPage() {
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
      <div className="bg-red-200 border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-900/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center shadow-[4px_4px_0_0_rgba(255,255,255,0.5)]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">免責聲明</h1>
            <p className="text-slate-800 font-bold text-sm tracking-widest uppercase mt-1">Disclaimer</p>
          </div>
        </div>
      </div>

      <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] p-6 sm:p-8 text-slate-800 space-y-8 leading-relaxed font-bold">
        <div className="bg-slate-50 p-4 sm:p-6 border-4 border-slate-900">
          <p className="text-slate-700 text-sm sm:text-base leading-loose">
            本網站「全國高級中等學校免試入學分發結果查詢」為「<strong className="text-black bg-yellow-200 px-1 border-b-2 border-black">TW會考落點分析</strong>」團隊所獨立開發與維護。<strong>本網站非屬任何政府機關、各縣市教育局處、各就學區免試入學委員會或各級學校之官方網站。</strong>
          </p>
        </div>
        
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-[2px_2px_0_0_rgba(203,213,225,1)]">1</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">資料來源與準確性</h3>
          </div>
          <ul className="list-none space-y-4 pl-4 sm:pl-11">
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              本網站提供之錄取名單、准考證號、姓名及相關數據，皆來自使用者自主使用公開榜單 PDF 檔案或文字進行上傳解析後產生之結果。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              本網站無法且不保證由系統自動解析或使用者手動修正之資料具有絕對的準確性、完整性或即時性。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              所有透過本網站查詢之榜單結果僅供參考，<strong className="text-black bg-yellow-200 px-1 border-b-2 border-black">實際錄取結果與各項招生資訊，請務必以各就學區免試入學委員會或各級學校之官方公告為準。</strong>
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-slate-900 before:border-2 before:border-slate-900">
              <a href="https://tyctw.github.io/front/" target="_blank" rel="noopener noreferrer" className="font-black text-indigo-700 hover:text-indigo-900 hover:underline transition-colors break-all">
                🔗 各就學區免試入學查榜官方網站 (https://tyctw.github.io/front/)
              </a>
            </li>
          </ul>
        </section>
        
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-[2px_2px_0_0_rgba(203,213,225,1)]">2</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">風險與責任承擔</h3>
          </div>
          <ul className="list-none space-y-4 pl-4 sm:pl-11">
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-red-500 before:border-2 before:border-slate-900">
              使用者應自行承擔使用本網站資訊之風險。若因依賴本網站資訊而作出任何決定或行動，致生任何損害或不便，本團隊不承擔任何法律與賠償責任。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-red-500 before:border-2 before:border-slate-900">
              本網站不對因系統中斷、網路連線問題、硬體故障或不可抗力因素所導致的資料遺失、錯誤或延遲承擔任何責任。
            </li>
            <li className="relative before:absolute before:-left-5 before:top-2 before:w-2 before:h-2 before:bg-red-500 before:border-2 before:border-slate-900">
              本網站對於因使用或無法使用本網站服務所致之任何直接、間接、附帶、衍生性或懲罰性損害，概不負責。
            </li>
          </ul>
        </section>
        
        <section>
          <div className="flex items-center gap-3 mb-5">
            <span className="w-8 h-8 bg-slate-900 text-white font-black flex items-center justify-center text-lg shadow-[2px_2px_0_0_rgba(203,213,225,1)]">3</span>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">智慧財產權聲明</h3>
          </div>
          <p className="pl-4 sm:pl-11 text-slate-700 leading-relaxed">
            本網站所使用之部分圖示、程式碼、設計皆為本團隊所有或已取得合法授權。唯網站中經解析產出之榜單原始資料（如學校名稱、科系、錄取資訊等），其相關權利歸屬各官方發布單位所有。使用者不得將本網站內容用於任何非法或未經授權之商業用途。
          </p>
        </section>
      </div>
    </div>
  );
}
