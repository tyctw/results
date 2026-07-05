import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, AlertCircle, BarChart3, PieChart } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, Legend
} from 'recharts';

export default function AdminStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [regionData, setRegionData] = useState<any[]>([]);
  const [schoolData, setSchoolData] = useState<any[]>([]);
  const [genderData, setGenderData] = useState<any[]>([]);
  const [yearData, setYearData] = useState<any[]>([]);
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [genderByRegionData, setGenderByRegionData] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('admissions')
          .select('region, school_name, department, gender, year')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        page++;
      }
      
      if (allData.length > 0) {
        const data = allData;
        // Aggregate by Region
        const regionCount = data.reduce((acc: any, curr) => {
          const r = curr.region || '未知';
          acc[r] = (acc[r] || 0) + 1;
          return acc;
        }, {});
        setRegionData(Object.entries(regionCount).map(([name, count]) => ({ name, count })).sort((a: any, b: any) => b.count - a.count));

        // Aggregate by School
        const schoolCount = data.reduce((acc: any, curr) => {
          const s = curr.school_name || '未知';
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {});
        setSchoolData(Object.entries(schoolCount).map(([name, count]) => ({ name, count })).sort((a: any, b: any) => b.count - a.count));

        // Aggregate by Gender
        const genderCount = data.reduce((acc: any, curr) => {
          const g = curr.gender || '未知';
          acc[g] = (acc[g] || 0) + 1;
          return acc;
        }, {});
        
        const COLORS = ['#0f172a', '#3b82f6', '#f59e0b', '#ef4444'];
        setGenderData(Object.entries(genderCount).map(([name, value], index) => ({ 
          name, 
          value,
          color: COLORS[index % COLORS.length]
        })));

        // Aggregate by Year
        const yearCount = data.reduce((acc: any, curr) => {
          const y = curr.year || '未知';
          acc[y] = (acc[y] || 0) + 1;
          return acc;
        }, {});
        setYearData(Object.entries(yearCount).map(([name, count]) => ({ name, count })).sort((a: any, b: any) => parseInt(a.name) - parseInt(b.name)));

        // Aggregate by Department
        const deptCount = data.reduce((acc: any, curr) => {
          const d = curr.department || '未知';
          acc[d] = (acc[d] || 0) + 1;
          return acc;
        }, {});
        setDepartmentData(Object.entries(deptCount).map(([name, count]) => ({ name, count })).sort((a: any, b: any) => b.count - a.count).slice(0, 10)); // Top 10

        // Aggregate Gender by Region
        const regionGenderCount = data.reduce((acc: any, curr) => {
          const r = curr.region || '未知';
          const g = curr.gender || '未知';
          if (!acc[r]) acc[r] = { name: r, 男: 0, 女: 0, 未知: 0 };
          
          if (g.includes('男') && !g.includes('女')) {
            acc[r]['男'] += 1;
          } else if (g.includes('女') && !g.includes('男')) {
            acc[r]['女'] += 1;
          } else if (g.includes('男女')) {
            // Assume mixed or something, maybe just use raw gender
             if (!acc[r][g]) acc[r][g] = 0;
             acc[r][g] += 1;
          } else {
             if (!acc[r][g]) acc[r][g] = 0;
             acc[r][g] += 1;
          }
          return acc;
        }, {});
        setGenderByRegionData(Object.values(regionGenderCount));
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '載入統計資料失敗');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 w-full bg-white">
        <Loader2 className="w-10 h-10 text-slate-900 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 w-full">
        <div className="p-5 bg-white border-4 border-slate-900 text-red-600 flex items-center gap-3 shadow-[4px_4px_0_0_rgba(239,68,68,1)]">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-black text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow p-4 sm:p-8 relative bg-slate-50 overflow-y-auto">
      
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          系統資料統計
        </h2>
        <p className="text-slate-600 text-sm font-bold mt-1">完整檢視各項資料維度的圖表與清單分析</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* Region Chart */}
        <div className="bg-white border-4 border-slate-900 p-6 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
          <h3 className="text-lg font-black text-slate-900 mb-6 border-b-4 border-slate-900 pb-2">考區資料分佈</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#0f172a', fontWeight: 'bold', fontSize: 12 }} axisLine={{ stroke: '#0f172a', strokeWidth: 2 }} tickLine={false} />
                <YAxis tick={{ fill: '#0f172a', fontWeight: 'bold', fontSize: 12 }} axisLine={{ stroke: '#0f172a', strokeWidth: 2 }} tickLine={false} />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ backgroundColor: '#fff', border: '4px solid #0f172a', borderRadius: '0', fontWeight: '900', color: '#0f172a', boxShadow: '4px 4px 0 0 rgba(15,23,42,1)' }}
                />
                <Bar dataKey="count" fill="#0f172a" name="收錄筆數" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gender Chart */}
        <div className="bg-white border-4 border-slate-900 p-6 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
          <h3 className="text-lg font-black text-slate-900 mb-6 border-b-4 border-slate-900 pb-2 flex items-center gap-2">
            <PieChart className="w-5 h-5" /> 性別分佈
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={genderData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#fff', border: '4px solid #0f172a', borderRadius: '0', fontWeight: '900', color: '#0f172a', boxShadow: '4px 4px 0 0 rgba(15,23,42,1)' }}
                />
                <Legend wrapperStyle={{ fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Year Chart */}
        <div className="bg-white border-4 border-slate-900 p-6 shadow-[8px_8px_0_0_rgba(15,23,42,1)] lg:col-span-2">
          <h3 className="text-lg font-black text-slate-900 mb-6 border-b-4 border-slate-900 pb-2">年度資料分佈</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#0f172a', fontWeight: 'bold', fontSize: 12 }} axisLine={{ stroke: '#0f172a', strokeWidth: 2 }} tickLine={false} />
                <YAxis tick={{ fill: '#0f172a', fontWeight: 'bold', fontSize: 12 }} axisLine={{ stroke: '#0f172a', strokeWidth: 2 }} tickLine={false} />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ backgroundColor: '#fff', border: '4px solid #0f172a', borderRadius: '0', fontWeight: '900', color: '#0f172a', boxShadow: '4px 4px 0 0 rgba(15,23,42,1)' }}
                />
                <Bar dataKey="count" fill="#3b82f6" name="收錄筆數" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Chart */}
        <div className="bg-white border-4 border-slate-900 p-6 shadow-[8px_8px_0_0_rgba(15,23,42,1)] lg:col-span-2">
          <h3 className="text-lg font-black text-slate-900 mb-6 border-b-4 border-slate-900 pb-2">熱門科系排行 (Top 10)</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                <XAxis type="number" tick={{ fill: '#0f172a', fontWeight: 'bold', fontSize: 12 }} axisLine={{ stroke: '#0f172a', strokeWidth: 2 }} tickLine={false} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fill: '#0f172a', fontWeight: 'bold', fontSize: 12 }} axisLine={{ stroke: '#0f172a', strokeWidth: 2 }} tickLine={false} />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ backgroundColor: '#fff', border: '4px solid #0f172a', borderRadius: '0', fontWeight: '900', color: '#0f172a', boxShadow: '4px 4px 0 0 rgba(15,23,42,1)' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" name="收錄筆數" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gender by Region Chart */}
        <div className="bg-white border-4 border-slate-900 p-6 shadow-[8px_8px_0_0_rgba(15,23,42,1)] lg:col-span-2">
          <h3 className="text-lg font-black text-slate-900 mb-6 border-b-4 border-slate-900 pb-2 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> 各區性別分佈
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genderByRegionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#0f172a', fontWeight: 'bold', fontSize: 12 }} axisLine={{ stroke: '#0f172a', strokeWidth: 2 }} tickLine={false} />
                <YAxis tick={{ fill: '#0f172a', fontWeight: 'bold', fontSize: 12 }} axisLine={{ stroke: '#0f172a', strokeWidth: 2 }} tickLine={false} />
                <RechartsTooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ backgroundColor: '#fff', border: '4px solid #0f172a', borderRadius: '0', fontWeight: '900', color: '#0f172a', boxShadow: '4px 4px 0 0 rgba(15,23,42,1)' }}
                />
                <Legend wrapperStyle={{ fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }} />
                {genderData.map((gender, idx) => (
                  <Bar key={gender.name} dataKey={gender.name} stackId="a" fill={gender.color} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Schools List */}
      <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
        <div className="p-6 border-b-4 border-slate-900 bg-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-900">收錄學校清單</h3>
          <span className="text-sm font-bold text-slate-600 bg-white px-3 py-1 border-2 border-slate-900">共 {schoolData.length} 所</span>
        </div>
        <div className="p-0 max-h-96 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900 text-white sticky top-0 z-10">
              <tr>
                <th className="p-4 pl-6 text-[11px] font-black uppercase tracking-wider whitespace-nowrap border-b-2 border-slate-900">排名</th>
                <th className="p-4 text-[11px] font-black uppercase tracking-wider whitespace-nowrap border-b-2 border-slate-900">學校名稱</th>
                <th className="p-4 pr-6 text-[11px] font-black uppercase tracking-wider whitespace-nowrap text-right border-b-2 border-slate-900">收錄筆數</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-200">
              {schoolData.map((school, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 pl-6 text-sm font-bold text-slate-500 w-16">#{idx + 1}</td>
                  <td className="p-4 text-sm font-black text-slate-900">{school.name}</td>
                  <td className="p-4 pr-6 text-sm font-bold text-slate-600 text-right">{school.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
