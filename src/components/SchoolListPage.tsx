import React, { useState, useEffect } from 'react';
import { X, Loader2, School, CheckCircle2, XCircle, ExternalLink, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { NATIONAL_SCHOOLS } from '../lib/nationalSchools';

type CombinedSchoolData = {
  code?: string;
  name: string;
  region: string;
  count: number;
  isNationalList: boolean;
  url?: string;
};

export default function SchoolListPage() {
  const [loading, setLoading] = useState(true);
  const [schoolData, setSchoolData] = useState<CombinedSchoolData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'collected' | 'missing'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    setLoading(true);
    setError(null);
    try {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('admissions')
          .select('school_name, region, year')
          .range(page * pageSize, (page + 1) * pageSize - 1);
          
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        page++;
      }
      
      const dbSchoolCounts: Record<string, number> = {};
      const dbSchoolYearCounts: Record<string, Record<string, number>> = {};
      
      if (allData.length > 0) {
        allData.forEach(curr => {
          // Some cleanups on school name might be needed, but we rely on exact matching first
          const s = curr.school_name || '未知';
          const y = curr.year || '未知';
          
          dbSchoolCounts[s] = (dbSchoolCounts[s] || 0) + 1;
          
          if (!dbSchoolYearCounts[s]) {
             dbSchoolYearCounts[s] = {};
          }
          dbSchoolYearCounts[s][y] = (dbSchoolYearCounts[s][y] || 0) + 1;
        });
      }

      const combined: Record<string, CombinedSchoolData> = {};

      // 1. Add all national schools
      NATIONAL_SCHOOLS.forEach(ns => {
        // Find if this school exists in DB (might have variations in name, but try exact match first)
        // Also check if db school name contains the national school name
        let matchName = ns.name;
        let count = 0;
        let years: Record<string, number> = {};
        
        // Exact match
        if (dbSchoolCounts[ns.name]) {
          count = dbSchoolCounts[ns.name];
          years = dbSchoolYearCounts[ns.name] || {};
          delete dbSchoolCounts[ns.name];
          delete dbSchoolYearCounts[ns.name];
        } else {
          // Try to find a partial match in DB records
          const normNsName = ns.name.replace(/^(國立|市立|縣立|私立|財團法人|臺北市|新北市|桃園市|臺中市|臺南市|高雄市|基隆市|新竹市|嘉義市|宜蘭縣|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|臺東縣|花蓮縣|澎湖縣|金門縣|連江縣)+/, '').replace(/(高級中等學校|高級中學|實驗高級中學|實驗學校|實驗教育學校|實驗中學|高中進修學校|中學進修學校|進修學校|高中|高工|高商|家商|商工|工商|工家|農工|家職|商水|海事水產|海事|護家|藝校|餐飲|餐旅|中學|學校)$/, '');
          
          const partialMatchKey = Object.keys(dbSchoolCounts).find(dbName => {
            if (dbName.includes(ns.name) || ns.name.includes(dbName)) return true;
            
            const normDbName = dbName.replace(/^(國立|市立|縣立|私立|財團法人|臺北市|新北市|桃園市|臺中市|臺南市|高雄市|基隆市|新竹市|嘉義市|宜蘭縣|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|臺東縣|花蓮縣|澎湖縣|金門縣|連江縣)+/, '').replace(/(高級中等學校|高級中學|實驗高級中學|實驗學校|實驗教育學校|實驗中學|高中進修學校|中學進修學校|進修學校|高中|高工|高商|家商|商工|工商|工家|農工|家職|商水|海事水產|海事|護家|藝校|餐飲|餐旅|中學|學校)$/, '');
            
            if (normNsName.length > 1 && normDbName.length > 1) {
              return normDbName.includes(normNsName) || normNsName.includes(normDbName);
            }
            return false;
          });

          if (partialMatchKey) {
            count = dbSchoolCounts[partialMatchKey];
            years = dbSchoolYearCounts[partialMatchKey] || {};
            matchName = partialMatchKey; // Use DB's name or keep ns.name
            delete dbSchoolCounts[partialMatchKey];
            delete dbSchoolYearCounts[partialMatchKey];
          }
        }

        combined[ns.name] = {
          code: ns.code,
          name: ns.name,
          region: ns.region,
          count: count,
          years: years,
          isNationalList: true,
          url: ns.url
        };
      });

      // 2. Add remaining DB schools that didn't match the national list
      Object.keys(dbSchoolCounts).forEach(dbName => {
        // Need to guess region from DB data if possible, or just use '未知'
        // For simplicity, we just set region as '其他'
        const r = allData?.find(d => d.school_name === dbName)?.region || '其他';
        combined[dbName] = {
          name: dbName,
          region: r,
          count: dbSchoolCounts[dbName],
          years: dbSchoolYearCounts[dbName] || {},
          isNationalList: false
        };
      });

      const sortedData = Object.values(combined).sort((a, b) => {
        // Sort by Region, then by count (descending), then by name
        if (a.region !== b.region) return a.region.localeCompare(b.region);
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
        
      setSchoolData(sortedData);
    } catch (err: any) {
      console.error(err);
      setError('載入學校資料失敗');
    } finally {
      setLoading(false);
    }
  };

  const filteredData = schoolData.filter(s => {
    if (filter === 'collected' && s.count === 0) return false;
    if (filter === 'missing' && s.count > 0) return false;
    if (searchQuery && !s.name.includes(searchQuery) && !s.region.includes(searchQuery)) return false;
    return true;
  });

  const collectedCount = schoolData.filter(s => s.count > 0).length;
  const totalNationalCount = NATIONAL_SCHOOLS.length;

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col flex-1 bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 sm:p-8 border-b-4 border-slate-900 bg-white shrink-0 gap-6 shadow-sm z-10 relative">
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <School className="w-8 h-8 text-blue-600" /> 全國高中職收錄情形
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex-grow sm:w-64 h-3 bg-slate-200 border-2 border-slate-900 rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-emerald-500 border-r-2 border-slate-900 transition-all duration-1000 ease-out"
                style={{ width: `${Math.round((collectedCount / totalNationalCount) * 100)}%` }}
              />
            </div>
            <p className="text-sm font-bold text-slate-600 whitespace-nowrap">
              已收錄 <span className="text-slate-900 text-base">{collectedCount}</span> / {totalNationalCount} ({Math.round((collectedCount / totalNationalCount) * 100)}%)
            </p>
          </div>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 p-5 sm:p-8 border-b-4 border-slate-900 bg-amber-50 shrink-0 z-30 sticky top-[68px]">
        <div className="flex-grow relative">
          <input 
            type="text" 
            aria-label="搜尋學校名稱或縣市"
            placeholder="搜尋學校名稱或縣市..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full border-4 border-slate-900 px-4 py-3 font-bold focus:outline-none focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none focus-visible:ring-4 focus-visible:ring-blue-400 shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-all bg-white text-slate-900 placeholder-slate-400 text-lg"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3 shrink-0 w-full sm:w-auto pb-2 sm:pb-0">
          <button 
            onClick={() => setFilter('all')}
            className={`px-1 sm:px-5 py-2 sm:py-3 text-sm sm:text-base font-black border-4 border-slate-900 transition-all whitespace-nowrap shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${filter === 'all' ? 'bg-slate-900 text-white translate-x-[2px] translate-y-[2px] shadow-[2px_2px_0_0_rgba(15,23,42,1)]' : 'bg-white text-slate-900'}`}
          >
            全部
          </button>
          <button 
            onClick={() => setFilter('collected')}
            className={`px-1 sm:px-5 py-2 sm:py-3 text-sm sm:text-base font-black border-4 border-slate-900 transition-all whitespace-nowrap shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${filter === 'collected' ? 'bg-emerald-400 text-slate-900 translate-x-[2px] translate-y-[2px] shadow-[2px_2px_0_0_rgba(15,23,42,1)]' : 'bg-white text-slate-900'}`}
          >
            已收錄
          </button>
          <button 
            onClick={() => setFilter('missing')}
            className={`px-1 sm:px-5 py-2 sm:py-3 text-sm sm:text-base font-black border-4 border-slate-900 transition-all whitespace-nowrap shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${filter === 'missing' ? 'bg-red-400 text-slate-900 translate-x-[2px] translate-y-[2px] shadow-[2px_2px_0_0_rgba(15,23,42,1)]' : 'bg-white text-slate-900'}`}
          >
            未收錄
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-8 bg-slate-50 relative flex-grow min-h-[300px]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 z-10">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-lg font-black text-slate-900 tracking-widest">載入中...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border-4 border-slate-900 text-red-600 font-black text-xl shadow-[8px_8px_0_0_rgba(239,68,68,1)] text-center flex flex-col items-center gap-4">
            <XCircle className="w-12 h-12" />
            {error}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6 pb-8">
              {filteredData.map((school, idx) => (
                <div key={idx} className={`group relative flex flex-col bg-white rounded-xl overflow-hidden border-2 border-slate-900 transition-all duration-300 ${school.count > 0 ? 'shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(15,23,42,1)]' : 'bg-slate-50/80 text-slate-500 shadow-sm opacity-80'}`}>
                  
                  {/* Status Indicator Bar */}
                  <div className={`h-2 w-full ${school.count > 0 ? 'bg-emerald-400 border-b-2 border-slate-900' : 'bg-slate-300 border-b-2 border-slate-300'}`}></div>

                  <div className="p-5 sm:p-6 flex flex-col flex-1 gap-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-md uppercase tracking-wider border-2 border-slate-900 ${school.count > 0 ? 'bg-emerald-300 text-emerald-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]' : 'bg-slate-200 text-slate-700 shadow-none'}`}>
                            {school.region}
                          </span>
                          {!school.isNationalList && (
                            <span className="text-xs font-black px-2.5 py-1 rounded-md uppercase tracking-wider bg-amber-300 text-amber-900 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                              非官方
                            </span>
                          )}
                        </div>
                        <h3 className={`font-black text-xl sm:text-2xl tracking-tight leading-snug line-clamp-2 ${school.count === 0 ? 'text-slate-500' : 'text-slate-900 group-hover:text-blue-700 transition-colors'}`}>
                          {school.name}
                        </h3>
                      </div>
                      
                      {school.count > 0 ? (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-slate-900 bg-emerald-400 flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                          <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-slate-300 bg-slate-200 flex items-center justify-center shrink-0">
                          <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-auto pt-4 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-t-2 border-dashed border-slate-200">
                      <div className="flex flex-col gap-2">
                        {school.count > 0 ? (
                          <>
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-black text-3xl sm:text-4xl text-slate-900 leading-none">{school.count.toLocaleString()}</span>
                              <span className="text-sm font-bold text-slate-500">筆資料</span>
                            </div>
                            {school.years && Object.keys(school.years).length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {Object.entries(school.years).sort((a, b) => b[0].localeCompare(a[0])).map(([year, count]) => (
                                  <div key={year} className="bg-slate-100 border-2 border-slate-900 rounded-md px-1.5 py-0.5 text-xs font-bold text-slate-800 flex items-center gap-1 shadow-[1px_1px_0_0_rgba(15,23,42,1)]">
                                    <span>{year}</span>
                                    <span className="bg-blue-200 text-blue-900 px-1 rounded-sm">{count}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-400">
                            <span className="text-sm font-bold">尚無收錄資料</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                        <a 
                          href={`https://www.google.com/search?q=${encodeURIComponent(`115 ${school.name} 免試入學 榜單`)}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className={`flex-1 sm:flex-none inline-flex items-center justify-center h-10 px-3 rounded-lg border-2 transition-all font-bold text-sm gap-1 ${school.count > 0 ? 'border-slate-900 bg-amber-300 text-slate-900 hover:bg-amber-400 shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(15,23,42,1)]' : 'border-slate-300 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-400'}`} 
                          title="搜尋榜單"
                        >
                          <Search className="w-4 h-4" />
                          <span>搜尋</span>
                        </a>
                        {school.url && (
                          <a href={school.url} target="_blank" rel="noopener noreferrer" className={`flex-1 sm:flex-none inline-flex items-center justify-center h-10 px-3 rounded-lg border-2 transition-all font-bold text-sm gap-1 ${school.count > 0 ? 'border-slate-900 bg-white text-slate-900 hover:bg-slate-50 shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_rgba(15,23,42,1)]' : 'border-slate-300 bg-white text-slate-500 hover:text-slate-700 hover:border-slate-400'}`} title="前往學校網站">
                            <ExternalLink className="w-4 h-4" />
                            <span>官網</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredData.length === 0 && (
              <div className="text-center p-12 bg-white border-4 border-slate-900 border-dashed text-slate-500 font-black text-xl flex flex-col items-center gap-4">
                <School className="w-16 h-16 text-slate-300" />
                找不到符合條件的學校資料
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
