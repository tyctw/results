import React, { useState, useEffect } from 'react';
import { Search, Loader2, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { supabase, AdmissionRecord } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { NATIONAL_SCHOOLS } from '../lib/nationalSchools';

export default function QueryPage() {
  const [query, setQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [results, setResults] = useState<AdmissionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInitialAlert, setShowInitialAlert] = useState(true);
  const [mathQuestion, setMathQuestion] = useState({ num1: 0, num2: 0, operator: '+', answer: 0 });
  const [mathAnswer, setMathAnswer] = useState('');
  const [completionRate, setCompletionRate] = useState<number | null>(null);
  const [currentAcademicYear, setCurrentAcademicYear] = useState<number>(115);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const generateMathQuestion = () => {
    const operators = ['+', '-', '×'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    let num1, num2, answer;

    if (operator === '+') {
      num1 = Math.floor(Math.random() * 20) + 1;
      num2 = Math.floor(Math.random() * 20) + 1;
      answer = num1 + num2;
    } else if (operator === '-') {
      num1 = Math.floor(Math.random() * 20) + 10;
      num2 = Math.floor(Math.random() * num1) + 1; // Ensure positive result
      answer = num1 - num2;
    } else { // '×'
      num1 = Math.floor(Math.random() * 9) + 2;
      num2 = Math.floor(Math.random() * 9) + 2;
      answer = num1 * num2;
    }

    setMathQuestion({ num1, num2, operator, answer });
    setMathAnswer('');
  };

  useEffect(() => {
    const fetchRate = async () => {
      const now = new Date();
      let year = now.getFullYear() - 1911;
      if (now.getMonth() < 6) { // 0-indexed, 6 is July. Month < 6 means Jan to June
        year -= 1;
      }
      setCurrentAcademicYear(year);
      
      try {
        const collectedSchools = new Set<string>();
        let page = 0;
        const pageSize = 1000;

        while (true) {
          const { data, error } = await supabase
            .from('admissions')
            .select('school_name')
            .eq('year', String(year))
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;

          data.forEach((record) => {
            if (record.school_name) collectedSchools.add(record.school_name);
          });

          if (data.length < pageSize) break;
          page += 1;
        }

        if (NATIONAL_SCHOOLS.length > 0) {
          setCompletionRate((collectedSchools.size / NATIONAL_SCHOOLS.length) * 100);
        }
      } catch (err) {
        console.error('Failed to fetch completion rate', err);
      }
    };
    
    fetchRate();
    generateMathQuestion();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background noise
    ctx.fillStyle = '#f8fafc'; // slate-50
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw some noise lines
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.strokeStyle = `rgba(15, 23, 42, ${Math.random() * 0.3 + 0.1})`; // slate-900 with low opacity
      ctx.lineWidth = Math.random() * 2 + 1;
      ctx.stroke();
    }

    // Draw some noise dots
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(15, 23, 42, ${Math.random() * 0.3 + 0.1})`;
      ctx.fill();
    }

    // Draw text with some distortion
    ctx.font = 'bold 18px JetBrains Mono, monospace, sans-serif';
    ctx.fillStyle = '#334155'; // slate-700
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = `${mathQuestion.num1} ${mathQuestion.operator} ${mathQuestion.num2} = ?`;
    
    // Small random rotation for the whole text
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((Math.random() - 0.5) * 0.05); // Reduced rotation to prevent cutoff
    ctx.fillText(text, 0, 0);
    ctx.restore();

  }, [mathQuestion]);

  const closeInitialAlert = () => {
    setShowInitialAlert(false);
  };

  const handleReportError = (record?: AdmissionRecord) => {
    const subject = encodeURIComponent("榜單查詢資料錯誤回報");
    let bodyText = `您好，我想回報資料錯誤：\n\n`;
    if (record) {
      bodyText += `准考證號碼或姓名： ${record.ticket_number || ''} ${record.student_name || ''}\n`;
      bodyText += `學校： ${record.school_name || ''}\n`;
      bodyText += `科系： ${record.department || ''}\n`;
    } else {
      bodyText += `准考證號碼或姓名： ${query}\n`;
      bodyText += `學校： \n`;
      bodyText += `科系： \n`;
    }
    bodyText += `正確應為： \n\n`;
    bodyText += `附註或說明： \n\n`;

    const body = encodeURIComponent(bodyText);
    window.open(`mailto:tyctw.analyze@gmail.com?subject=${subject}&body=${body}`);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedQuery = query.trim();
    
    if (!trimmedQuery) {
      setError('請輸入查詢關鍵字。');
      return;
    }
    
    // Only allow numbers, letters, Chinese characters, spaces, and the circle symbol for masked names
    const validPattern = /^[\u4e00-\u9fa5a-zA-Z0-9\s\u25cb]+$/;
    if (!validPattern.test(trimmedQuery)) {
      setError('請勿輸入特殊符號，僅限輸入數字與文字。');
      return;
    }
    
    // Check if it looks like a Taiwanese ID number (1 letter + 9 digits)
    const idRegex = /^[A-Za-z][1289]\d{8}$/;
    if (idRegex.test(trimmedQuery)) {
      setError('為保護您的個人資料安全，系統拒絕使用身分證字號查詢。請改用姓名或准考證號。');
      return;
    }
    
    if (!mathAnswer) {
      setError('請輸入防機器人驗證答案。');
      return;
    }
    
    if (parseInt(mathAnswer) !== mathQuestion.answer) {
      setError('防機器人驗證錯誤，請重新計算。');
      generateMathQuestion();
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      // Allow searching by ticket_number, student_name, or school_name
      const conditions = [
        `ticket_number.ilike.%${trimmedQuery}%`,
        `school_name.ilike.%${trimmedQuery}%`,
        `student_name.ilike.%${trimmedQuery}%`
      ];

      // Automatically try to match masked names (e.g. "王O明" or "王○明") if the user enters a full name
      if (trimmedQuery.length === 3) {
        conditions.push(`student_name.ilike.%${trimmedQuery[0]}_${trimmedQuery[2]}%`);
      } else if (trimmedQuery.length === 2) {
        conditions.push(`student_name.ilike.%${trimmedQuery[0]}_%`);
      } else if (trimmedQuery.length === 4) {
        conditions.push(`student_name.ilike.%${trimmedQuery.substring(0, 2)}_${trimmedQuery[3]}%`);
        conditions.push(`student_name.ilike.%${trimmedQuery[0]}_${trimmedQuery[2]}${trimmedQuery[3]}%`);
        conditions.push(`student_name.ilike.%${trimmedQuery[0]}__${trimmedQuery[3]}%`);
      }

      let queryBuilder = supabase
        .from('admissions')
        .select('*')
        .or(conditions.join(','));

      if (selectedRegion) {
        let regionsToSearch: string[] = [];
        
        switch (selectedRegion) {
          case '基北區':
            regionsToSearch = ['基北', '台北', '臺北', '新北', '基隆'];
            break;
          case '桃連區':
            regionsToSearch = ['桃連', '桃園', '連江', '馬祖'];
            break;
          case '竹苗區':
            regionsToSearch = ['竹苗', '新竹', '苗栗'];
            break;
          case '中投區':
            regionsToSearch = ['中投', '台中', '臺中', '南投'];
            break;
          case '嘉義區':
            regionsToSearch = ['嘉義'];
            break;
          case '臺南區':
            regionsToSearch = ['台南', '臺南'];
            break;
          case '臺北區':
            regionsToSearch = ['台北', '臺北'];
            break;
          case '臺東區':
            regionsToSearch = ['台東', '臺東'];
            break;
          default:
            let baseRegion = selectedRegion.replace(/區$/, '');
            regionsToSearch = [baseRegion];
            if (baseRegion.includes('臺') || baseRegion.includes('台')) {
              regionsToSearch.push(baseRegion.replace(/臺/g, '台'));
              regionsToSearch.push(baseRegion.replace(/台/g, '臺'));
            }
            break;
        }
        
        // Remove duplicates
        regionsToSearch = Array.from(new Set(regionsToSearch));
        
        // Build ilike conditions for regions
        const regionConditions = regionsToSearch.map(r => `region.ilike.%${r}%`);
        
        queryBuilder = queryBuilder.or(regionConditions.join(','));
      }

      const { data, error: sbError } = await queryBuilder.limit(1000);

      if (sbError) {
        throw sbError;
      }

      setResults(data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '查詢失敗');
    } finally {
      setLoading(false);
      generateMathQuestion();
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col min-h-[calc(100vh-8rem)]">
        
        <header className="bg-indigo-300 border-b-4 border-slate-900 z-20">
          <div className="p-5 sm:p-8 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-5 sm:gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="bg-slate-900 text-white w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0 border-2 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <Search className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900 mb-0.5 sm:mb-1">榜單查詢系統</h1>
                <p className="text-slate-600 text-[10px] sm:text-xs font-bold tracking-wider uppercase">Admission Results Query</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="inline-flex items-center justify-center gap-2 bg-green-200 border-2 border-slate-900 px-3 py-2 sm:py-2.5 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-600"></span>
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  {currentAcademicYear}年度資料更新完成率：{completionRate !== null ? `${completionRate.toFixed(1)}%` : '計算中...'}
                </span>
              </div>
              <Link to="/schools" className="brutal-btn flex items-center justify-center gap-2 px-4 py-3 sm:px-5 sm:py-2.5 text-slate-900 text-sm font-bold w-full sm:w-auto">
                查看收錄的學校
              </Link>
            </div>
          </div>
        </header>

        <div className="bg-amber-300 border-b-4 border-slate-900 overflow-hidden relative flex items-center h-10 w-full z-10 whitespace-nowrap">
          <div className="inline-block animate-marquee whitespace-nowrap font-black text-slate-900 tracking-wide text-[13px] sm:text-sm" style={{ width: "max-content" }}>
            <span className="mx-8">🚨 {currentAcademicYear}年度各就學區免試入學榜單資料，將於 7 月 7 日上午 11:00 放榜後陸續由系統蒐集整理並公告。若您需要即時掌握最新錄取結果，建議直接前往各就學區免試入學官方網站查詢！</span>
            <span className="mx-8">🚨 {currentAcademicYear}年度各就學區免試入學榜單資料，將於 7 月 7 日上午 11:00 放榜後陸續由系統蒐集整理並公告。若您需要即時掌握最新錄取結果，建議直接前往各就學區免試入學官方網站查詢！</span>
            <span className="mx-8">🚨 {currentAcademicYear}年度各就學區免試入學榜單資料，將於 7 月 7 日上午 11:00 放榜後陸續由系統蒐集整理並公告。若您需要即時掌握最新錄取結果，建議直接前往各就學區免試入學官方網站查詢！</span>
            <span className="mx-8">🚨 {currentAcademicYear}年度各就學區免試入學榜單資料，將於 7 月 7 日上午 11:00 放榜後陸續由系統蒐集整理並公告。若您需要即時掌握最新錄取結果，建議直接前往各就學區免試入學官方網站查詢！</span>
          </div>
        </div>

        <main className="flex-grow p-4 sm:p-8 flex flex-col items-center bg-slate-50">
          <div className="w-full max-w-4xl mb-10 mt-4 sm:mt-10 relative">
            <div className="relative flex flex-col gap-6 w-full">
              <div className="flex items-start sm:items-center gap-2 bg-rose-100 border-2 border-slate-900 p-3 shadow-[2px_2px_0_0_rgba(15,23,42,1)] w-full">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5 sm:mt-0" strokeWidth={3} />
                <span className="font-black text-xs sm:text-sm tracking-wider text-rose-800 leading-tight">為保護您的個人資料安全，請勿輸入「身分證字號」進行查詢。</span>
              </div>
              
              <form onSubmit={handleSearch} className="flex flex-col w-full bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden">
                <div className="bg-amber-100 p-3 sm:p-4 border-b-4 border-slate-900 flex justify-between items-center">
                  <label htmlFor="query-input" className="text-slate-900 font-black tracking-widest text-sm sm:text-base flex items-center gap-2">
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                    在此輸入查詢條件
                  </label>
                </div>
                <div className="flex flex-col p-4 sm:p-6 border-b-4 border-slate-900 bg-white focus-within:bg-blue-50 transition-colors">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 bg-white border-4 border-slate-900 p-3 sm:p-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)] focus-within:shadow-[6px_6px_0_0_rgba(15,23,42,1)] focus-within:-translate-y-0.5 transition-all">
                    
                    {/* Region Select */}
                    <button 
                      type="button"
                      onClick={() => setIsRegionModalOpen(true)}
                      className="flex items-center justify-between border-b-2 sm:border-b-0 sm:border-r-2 border-slate-200 pb-3 sm:pb-0 sm:pr-4 shrink-0 relative group min-w-[120px]"
                    >
                      <span className="bg-transparent font-black text-slate-900 outline-none text-base sm:text-lg cursor-pointer w-full text-left pr-8 truncate">
                        {selectedRegion ? (selectedRegion === '臺南區' ? '臺南區 (台南)' : selectedRegion === '臺東區' ? '臺東區 (台東)' : selectedRegion) : '所有考區'}
                      </span>
                      <div className="pointer-events-none absolute right-1 sm:right-5 top-4 sm:top-1/2 -translate-y-1/2 text-slate-500 text-xs group-hover:text-slate-900 transition-colors">▼</div>
                    </button>

                    <div className="flex items-center gap-3 sm:gap-4 flex-grow pt-1 sm:pt-0">
                      <Search className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 shrink-0" strokeWidth={3} />
                      <input
                        id="query-input"
                        type="text"
                        className="w-full outline-none font-black bg-transparent text-slate-900 placeholder:text-slate-400 text-lg sm:text-2xl"
                        placeholder="請點擊此處輸入..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-500 mt-3 ml-1 tracking-wide">
                    支援的關鍵字：准考證號、姓名、學校名稱（可輸入全名或部分字詞）
                  </p>
                </div>
                
                <div className="flex flex-col items-stretch">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center p-4 sm:p-5 gap-3 sm:gap-4 bg-slate-50 border-b-4 border-slate-900">
                    <div className="flex sm:block justify-between items-center w-full sm:w-auto">
                      <label htmlFor="math-answer" className="font-black text-slate-900 text-sm sm:text-base tracking-wider whitespace-nowrap shrink-0">防機器人驗證：</label>
                      <span className="text-xs text-slate-500 font-bold sm:hidden">點擊圖片可換題</span>
                    </div>
                    <div className="flex flex-row items-center gap-2 sm:gap-4 w-full">
                      <canvas 
                        ref={canvasRef} 
                        width={160} 
                        height={44} 
                        className="border-2 border-slate-900 bg-white cursor-pointer hover:-translate-y-0.5 shadow-[2px_2px_0_0_rgba(15,23,42,1)] transition-transform shrink-0 w-[140px] sm:w-[160px] h-[44px] object-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
                        onClick={generateMathQuestion}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') generateMathQuestion(); }}
                        tabIndex={0}
                        title="點擊更換題目"
                        role="button"
                        aria-label="防機器人驗證題目，點擊可更換題目"
                      />
                      <input
                        id="math-answer"
                        type="number"
                        className="flex-1 min-w-0 h-[44px] px-2 sm:px-4 outline-none font-black bg-white border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] text-slate-900 text-center focus:bg-amber-50 focus:translate-x-[1px] focus:translate-y-[1px] focus:shadow-[1px_1px_0_0_rgba(15,23,42,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-all text-lg hide-spin-button"
                        placeholder="輸入答案"
                        value={mathAnswer}
                        onChange={(e) => setMathAnswer(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="bg-blue-600 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-8 py-5 flex items-center justify-center text-xl font-black transition-colors w-full tracking-widest"
                    disabled={loading || !mathAnswer}
                  >
                    {loading ? <Loader2 className="animate-spin w-6 h-6 mr-3" /> : <Search className="w-6 h-6 mr-3" strokeWidth={3} />}
                    <span>開始搜尋</span>
                  </button>
                </div>
              </form>
            </div>
            {error && (
              <div className="mt-6 p-4 bg-rose-50 border-4 border-slate-900 flex items-start gap-3 shadow-[8px_8px_0_0_rgba(225,29,72,1)]">
                <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" strokeWidth={3} />
                <p className="text-sm sm:text-base font-black text-slate-900 leading-relaxed pt-0.5">{error}</p>
              </div>
            )}
          </div>

          <div className="w-full max-w-4xl relative z-10">
            {searched && !loading && results.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center bg-white border-4 border-slate-900 border-dashed shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <div className="bg-slate-900 p-4 mb-4 text-white border-2 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                  <Search className="w-8 h-8" />
                </div>
                <p className="text-slate-900 font-black tracking-widest text-sm uppercase font-mono">查無相符資料</p>
                <p className="text-xs text-slate-600 mt-2 font-bold font-mono tracking-wider">請嘗試使用其他關鍵字搜尋</p>
                <button 
                  onClick={() => handleReportError()} 
                  className="mt-6 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:bg-slate-200 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] transition-all flex items-center gap-2"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  資料有誤？回報給我們
                </button>
              </div>
            )}

            {results.length > 0 && (
              <div className="flex flex-col gap-4 w-full animate-in fade-in duration-500 pb-10">
                <div className="flex justify-between items-end px-2 mb-2 border-b-4 border-slate-900 pb-2">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">查詢結果 <span className="text-slate-500 font-bold text-sm ml-2">({results.length} 筆資料)</span></h2>
                  </div>
                </div>
                
                <div className={`grid grid-cols-1 gap-6 w-full ${
                  results.length === 1 ? 'max-w-md mx-auto' :
                  results.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' :
                  'md:grid-cols-2 lg:grid-cols-3'
                }`}>
                  {results.map((record, idx) => (
                    <div key={record.id || idx} className="bg-white border-4 border-slate-900 shadow-[6px_6px_0_0_rgba(15,23,42,1)] p-6 flex flex-col hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0_0_rgba(15,23,42,1)] transition-all">
                      <div className="flex justify-between items-start mb-4 border-b-2 border-slate-200 pb-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{record.region || '未分區'}</span>
                          <h3 className="text-xl font-black text-slate-900 leading-tight">{record.school_name || '-'}</h3>
                        </div>
                        <div className="bg-slate-100 border-2 border-slate-900 px-2.5 py-1 flex items-center justify-center shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                          <span className="text-xs font-black text-slate-900">{record.year || '-'}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-3 flex-grow">
                        <div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">科組名稱 / Department</span>
                          <span className="text-sm font-bold text-slate-800">{record.department || '-'}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t-2 border-slate-100">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">准考證號 / Ticket</span>
                            <span className="text-sm font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 border border-slate-200 inline-block">{record.ticket_number || '-'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">姓名 / Name</span>
                            <span className="text-base font-black text-slate-900 tracking-wide">{record.student_name || '-'}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={() => handleReportError(record)}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-1"
                          >
                            <AlertTriangle className="w-3 h-3" />
                            資料錯誤回報
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        
        {showInitialAlert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-amber-50 border-4 border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] w-full max-w-md overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300">
              {/* Warning Tape Decoration */}
              <div className="absolute top-0 left-0 w-full h-3 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#fbbf24_10px,#fbbf24_20px)] border-b-4 border-slate-900 z-10"></div>
              
              <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 pt-6 sm:pt-8 border-b-4 border-slate-900 bg-white relative z-0">
                <div className="bg-amber-400 text-slate-900 w-10 h-10 shrink-0 flex items-center justify-center border-4 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] rotate-[-6deg]">
                  <AlertTriangle className="w-5 h-5" strokeWidth={3} />
                </div>
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">非官方網站提醒</h3>
                    <p className="text-slate-500 font-bold text-[10px] tracking-wider border-2 border-slate-900 px-1.5 py-0.5 bg-slate-100 shadow-[2px_2px_0_0_rgba(15,23,42,1)] -mt-1 sm:mt-0">UNOFFICIAL WEBSITE</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 sm:p-5 space-y-4 bg-amber-50 overflow-y-auto max-h-[60vh]">
                <div className="bg-white border-2 border-slate-900 p-3 sm:p-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                  <p className="text-slate-800 font-bold text-xs sm:text-sm leading-relaxed text-justify">
                    本網站為<span className="font-black text-amber-700 bg-amber-200 px-1 mx-0.5 border border-amber-300">非官方自製系統</span>，本站之榜單資料皆由程式自動解析，可能會有遺漏或錯誤，查詢結果僅供參考。
                  </p>
                  <p className="text-slate-800 font-bold text-xs sm:text-sm leading-relaxed text-justify mt-3 border-t-2 border-dashed border-slate-300 pt-3">
                    <strong className="text-slate-900">實際錄取結果與各項招生資訊，請務必以各就學區免試入學委員會或各級學校之官方公告為準。</strong>
                  </p>
                </div>

                <a href="https://tyctw.github.io/front/" target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between bg-white border-2 border-slate-900 p-3 hover:bg-indigo-50 transition-colors shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_rgba(15,23,42,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
                  <div className="flex flex-col">
                    <span className="text-[9px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">OFFICIAL LINK</span>
                    <span className="font-black text-indigo-700 text-xs sm:text-sm group-hover:text-indigo-900 transition-colors">各就學區免試入學查榜官方網站</span>
                  </div>
                  <div className="bg-indigo-100 p-1.5 border-2 border-indigo-200 group-hover:bg-indigo-200 group-hover:border-indigo-300 transition-colors rounded-full shrink-0">
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-700" strokeWidth={3} />
                  </div>
                </a>
              </div>

              <div className="p-4 sm:p-5 bg-white flex flex-col sm:flex-row justify-end gap-3 border-t-4 border-slate-900">
                <Link 
                  to="/disclaimer"
                  onClick={() => closeInitialAlert()}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 border-2 border-slate-900 font-black hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all w-full sm:w-auto text-center tracking-wider text-xs sm:text-sm inline-block"
                >
                  閱讀完整聲明
                </Link>
                <button 
                  onClick={closeInitialAlert} 
                  className="px-5 py-2.5 bg-amber-400 text-slate-900 border-2 border-slate-900 font-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:bg-amber-300 hover:shadow-[3px_3px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex justify-center items-center gap-2 w-full sm:w-auto text-xs sm:text-sm tracking-wider"
                >
                  我已了解
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Region Selection Modal */}
        {isRegionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div 
              className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] w-full max-w-lg flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="bg-amber-100 p-4 border-b-4 border-slate-900 flex justify-between items-center shrink-0">
                <h3 className="font-black text-slate-900 text-lg sm:text-xl tracking-wider flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full"></div>
                  選擇考區
                </h3>
                <button 
                  onClick={() => setIsRegionModalOpen(false)}
                  className="p-1 hover:bg-amber-200 rounded-md transition-colors"
                >
                  <X className="w-6 h-6 text-slate-900" strokeWidth={3} />
                </button>
              </div>
              
              <div className="p-4 sm:p-6 overflow-y-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      setSelectedRegion('');
                      setIsRegionModalOpen(false);
                    }}
                    className={`p-3 border-2 border-slate-900 font-black text-sm sm:text-base transition-all ${
                      selectedRegion === '' 
                        ? 'bg-blue-500 text-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] translate-x-[2px] translate-y-[2px]' 
                        : 'bg-white text-slate-700 hover:bg-slate-100 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_rgba(15,23,42,1)]'
                    }`}
                  >
                    所有考區
                  </button>
                  {['基北區', '桃連區', '竹苗區', '中投區', '彰化區', '雲林區', '嘉義區', '臺南區', '高雄區', '屏東區', '宜蘭區', '花蓮區', '臺東區', '澎湖區', '金門區'].map((region) => (
                    <button
                      key={region}
                      onClick={() => {
                        setSelectedRegion(region);
                        setIsRegionModalOpen(false);
                      }}
                      className={`p-3 border-2 border-slate-900 font-black text-sm sm:text-base transition-all ${
                        selectedRegion === region
                          ? 'bg-blue-500 text-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] translate-x-[2px] translate-y-[2px]' 
                          : 'bg-white text-slate-700 hover:bg-slate-100 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[3px_3px_0_0_rgba(15,23,42,1)]'
                      }`}
                    >
                      {region === '臺南區' ? '臺南區 (台南)' : region === '臺東區' ? '臺東區 (台東)' : region}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
