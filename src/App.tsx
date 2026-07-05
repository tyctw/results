
import React, { useState, useEffect } from 'react';
import { Upload, FileText, Search, Download, AlertCircle, RotateCcw, Database, ExternalLink, X, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { extractDataFromPdf, parseRawText, ParsedData } from './lib/parser';
import { Routes, Route, Link } from 'react-router-dom';
import QueryPage from './components/QueryPage';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import AdminLogin from './components/AdminLogin';
import AdminDatabase from './components/AdminDatabase';
import AdminStats from './components/AdminStats';

import SchoolListPage from './components/SchoolListPage';
import PrivacyPolicyPage from './components/PrivacyPolicyPage';
import TermsOfServicePage from './components/TermsOfServicePage';
import DisclaimerPage from './components/DisclaimerPage';

function ParserTool() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'text' | 'url' | 'batch'>('upload');
  const [rawText, setRawText] = useState('');
  const [url, setUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [popupMessage, setPopupMessage] = useState<{title: string; type: 'success' | 'error' | 'warning'; message: string} | null>(null);
  const [failedBatchUrls, setFailedBatchUrls] = useState<string[]>([]);
  const [showFailedBatchModal, setShowFailedBatchModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  
  // Bulk edit states
  const [bulkYear, setBulkYear] = useState('');
  const [bulkRegion, setBulkRegion] = useState('');
  const [bulkSchool, setBulkSchool] = useState('');
  const [bulkDept, setBulkDept] = useState('');

  const hasUnsavedData = data && data.students.length > 0 && !saveSuccess;

  useEffect(() => {
    window.hasUnsavedData = !!hasUnsavedData;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedData) {
        e.preventDefault();
        e.returnValue = '您有尚未儲存的解析資料，確定要離開嗎？';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.hasUnsavedData = false;
    };
  }, [hasUnsavedData]);

  // Duplicate detection
  const duplicateTickets = React.useMemo(() => {
    if (!data) return new Set<string>();
    const counts = new Map<string, number>();
    data.students.forEach(s => {
      if (s.ticketNumber) {
        counts.set(s.ticketNumber, (counts.get(s.ticketNumber) || 0) + 1);
      }
    });
    const duplicates = new Set<string>();
    counts.forEach((count, ticket) => {
      if (count > 1) duplicates.add(ticket);
    });
    return duplicates;
  }, [data]);

  const handleRemoveDuplicates = () => {
    if (!data) return;
    const seen = new Set<string>();
    const newStudents = data.students.filter(s => {
      if (!s.ticketNumber) return true;
      if (seen.has(s.ticketNumber)) return false;
      seen.add(s.ticketNumber);
      return true;
    });
    const removedCount = data.students.length - newStudents.length;
    setData({ ...data, students: newStudents, admittedCount: newStudents.length.toString() });
    setShowDuplicateConfirm(false);
    
    if (removedCount > 0) {
      setPopupMessage({
        title: '移除成功',
        message: `已成功移除 ${removedCount} 筆重複資料。`,
        type: 'success'
      });
    }
  };


  const computeMergedData = (prev: ParsedData | null, newData: ParsedData): { merged: ParsedData; addedCount: number } => {
    if (!prev) return { merged: newData, addedCount: newData.students.length };
    
    const existingSignatures = new Set(prev.students.map(s => `${s.ticketNumber || ''}-${s.name || ''}`));
    
    const newStudents = newData.students.filter(s => {
      const sig = `${s.ticketNumber || ''}-${s.name || ''}`;
      if (existingSignatures.has(sig)) return false;
      existingSignatures.add(sig);
      return true;
    });
    
    if (newStudents.length === 0) {
      return { merged: prev, addedCount: 0 };
    }
    
    const combinedSchools = new Set([...prev.students, ...newStudents].map(s => s.schoolName).filter(Boolean));
    const mergedSchoolName = combinedSchools.size > 1 ? '多校區資料 (Multiple)' : (prev.schoolName || newData.schoolName);
    
    const combinedDepts = new Set([...prev.students, ...newStudents].map(s => s.department).filter(Boolean));
    const mergedDept = combinedDepts.size > 1 ? '多科組資料 (Multiple)' : (prev.department || newData.department);

    const combinedYears = new Set([prev.year, newData.year].filter(Boolean));
    const mergedYear = combinedYears.size > 1 ? '多年度資料 (Multiple)' : (prev.year || newData.year);

    const combinedRegions = new Set([prev.region, newData.region].filter(Boolean));
    const mergedRegion = combinedRegions.size > 1 ? '多考區資料 (Multiple)' : (prev.region || newData.region);

    const merged = {
      ...prev,
      schoolName: mergedSchoolName,
      department: mergedDept,
      year: mergedYear,
      region: mergedRegion,
      gender: prev.gender === newData.gender ? prev.gender : '多筆資料',
      admittedCount: (prev.students.length + newStudents.length).toString(),
      students: [...prev.students, ...newStudents],
    };

    return { merged, addedCount: newStudents.length };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);
    setSaveSuccess(false);
    
    let invalidFormat = false;
    let parseError = false;
    let successCount = 0;
    let totalAddedCount = 0;

    let currentData = data;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') {
        invalidFormat = true;
        continue;
      }
      try {
        const parsed = await extractDataFromPdf(file);
        const { merged, addedCount } = computeMergedData(currentData, parsed);
        currentData = merged;
        totalAddedCount += addedCount;
        successCount++;
      } catch (err) {
        console.error('Failed to parse file:', file.name, err);
        parseError = true;
      }
    }

    if (successCount > 0) {
      setData(currentData);
      if (totalAddedCount === 0) {
        setPopupMessage({
          title: '資料重複',
          message: '此資料已讀取過，無新增任何非重複的資料。',
          type: 'warning'
        });
      }
    }

    if (invalidFormat && parseError) {
      setError(prev => prev ? prev + ' (部分檔案非 PDF 格式，且部分 PDF 解析失敗)' : '部分檔案非 PDF 格式，且部分 PDF 解析失敗。');
    } else if (invalidFormat) {
      setError(prev => prev ? prev + ' (部分檔案非 PDF 格式，已跳過)' : '部分檔案非 PDF 格式，已跳過。');
    } else if (parseError) {
      if (successCount === 0) {
        setError('解析 PDF 時發生錯誤。檔案可能已加密或格式不支援。');
      } else {
        setError(prev => prev ? prev + ' (部分 PDF 解析失敗，已跳過)' : '部分 PDF 解析失敗，已跳過。');
      }
    }

    setLoading(false);
    e.target.value = '';
  };

  const handleTextParse = () => {
    if (!rawText.trim()) {
      setError('請輸入文字');
      return;
    }
    setLoading(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const parsed = parseRawText(rawText);
      const { merged, addedCount } = computeMergedData(data, parsed);
      setData(merged);
      if (addedCount === 0) {
        setPopupMessage({
          title: '資料重複',
          message: '此資料已讀取過，無新增任何非重複的資料。',
          type: 'warning'
        });
      }
      setRawText('');
    } catch (err) {
      console.error(err);
      setError('解析文字時發生錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlFetch = async () => {
    if (!url.trim()) {
      setError('請輸入網址');
      return;
    }
    setLoading(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const response = await fetch(`/api/proxy/pdf?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '無法從該網址獲取 PDF');
      }
      
      const blob = await response.blob();
      const file = new File([blob], "downloaded.pdf", { type: "application/pdf" });
      
      const parsed = await extractDataFromPdf(file);
      const { merged, addedCount } = computeMergedData(data, parsed);
      setData(merged);
      if (addedCount === 0) {
        setPopupMessage({
          title: '資料重複',
          message: '此資料已讀取過，無新增任何非重複的資料。',
          type: 'warning'
        });
      }
      setUrl('');
    } catch (err: any) {
      console.error(err);
      setError(`解析網址時發生錯誤: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBatchTemplate = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "URL\n";
    csvContent += "https://example.com/results1.pdf\n";
    csvContent += "https://example.com/results2.pdf\n";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "批次解析網址模板.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBatchCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) throw new Error('CSV 檔案格式錯誤或無資料');

        const headers = lines[0].split(',').map(h => h.trim());
        const urlIdx = headers.findIndex(h => h.toLowerCase() === 'url' || h === '網址');
        const yearIdx = headers.findIndex(h => h === '年度' || h === 'year');
        const regionIdx = headers.findIndex(h => h === '考區' || h === 'region');
        const schoolIdx = headers.findIndex(h => h === '學校名稱' || h === 'school');
        const deptIdx = headers.findIndex(h => h === '科組名稱' || h === 'department');
        const genderIdx = headers.findIndex(h => h === '性別' || h === 'gender');

        if (urlIdx === -1) {
          throw new Error('CSV 缺少必要的 URL 欄位');
        }

        let currentData = data;
        let successCount = 0;
        let errorCount = 0;
        const failedUrlsList: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(c => c.trim());
          const targetUrl = row[urlIdx];
          if (!targetUrl) continue;

          try {
            const response = await fetch(`/api/proxy/pdf?url=${encodeURIComponent(targetUrl)}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const blob = await response.blob();
            const pdfFile = new File([blob], `batch_${i}.pdf`, { type: "application/pdf" });
            
            const parsed = await extractDataFromPdf(pdfFile);
            
            // Override with CSV metadata if provided
            if (yearIdx !== -1 && row[yearIdx]) parsed.year = row[yearIdx];
            if (regionIdx !== -1 && row[regionIdx]) parsed.region = row[regionIdx];
            if (schoolIdx !== -1 && row[schoolIdx]) {
               parsed.schoolName = row[schoolIdx];
               parsed.students.forEach(s => s.schoolName = row[schoolIdx]);
            }
            if (deptIdx !== -1 && row[deptIdx]) {
               parsed.department = row[deptIdx];
               parsed.students.forEach(s => s.department = row[deptIdx]);
            }
            if (genderIdx !== -1 && row[genderIdx]) parsed.gender = row[genderIdx];

            const { merged } = computeMergedData(currentData, parsed);
            currentData = merged;
            successCount++;
          } catch (err) {
            console.error(`Failed to parse URL ${targetUrl}:`, err);
            errorCount++;
            failedUrlsList.push(targetUrl);
          }
        }

        setData(currentData);
        if (errorCount > 0) {
          setError(`批次解析完成。成功: ${successCount} 筆，失敗: ${errorCount} 筆。`);
          setFailedBatchUrls(failedUrlsList);
          setShowFailedBatchModal(true);
        } else {
          setError(null);
        }
      } catch (err: any) {
        console.error('Batch CSV import error:', err);
        setError(`批次解析發生錯誤: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('讀取檔案失敗');
      setLoading(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadTemplate = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "年度,考區,學校名稱,科組名稱,准考證號,姓名\n";
    csvContent += "114,桃連區,市立觀音高中,普通科,12345678,王小明\n";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "榜單匯入模板.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        // Split by lines and filter out empty ones
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          throw new Error('CSV 檔案格式錯誤或無資料');
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const expectedHeaders = ["年度", "考區", "學校名稱", "科組名稱", "准考證號", "姓名"];
        
        // Very basic validation, mostly just checks if headers match approximately
        const isValid = expectedHeaders.every(h => headers.some(sh => sh.includes(h)));
        if (!isValid) {
          throw new Error('CSV 標題列格式不符，請下載模板確認');
        }

        const students: any[] = [];
        let globalYear = '';
        let globalRegion = '';
        let globalSchool = '';
        let globalDept = '';

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(',').map(c => c.trim());
          if (row.length < 6) continue;
          
          const [year, region, school, dept, ticket, name] = row;
          
          if (!globalYear && year) globalYear = year;
          if (!globalRegion && region) globalRegion = region;
          if (!globalSchool && school) globalSchool = school;
          if (!globalDept && dept) globalDept = dept;
          
          if (ticket && name) {
            students.push({
              ticketNumber: ticket,
              name: name,
              department: dept,
              schoolName: school,
              year: year,
              region: region
            });
          }
        }

        if (students.length === 0) {
          throw new Error('找不到任何學生資料');
        }

        const newData: ParsedData = {
          year: globalYear,
          region: globalRegion,
          schoolName: globalSchool,
          department: globalDept,
          gender: '不限',
          admittedCount: students.length.toString(),
          students: students,
        };

        const { merged, addedCount } = computeMergedData(data, newData);
        setData(merged);
        if (addedCount === 0) {
          setPopupMessage({
            title: '資料重複',
            message: '此資料已讀取過，無新增任何非重複的資料。',
            type: 'warning'
          });
        }
      } catch (err: any) {
        console.error('CSV import error:', err);
        setError(`匯入 CSV 時發生錯誤: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('讀取檔案失敗');
      setLoading(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getRealValue = (studentVal?: string, globalVal?: string) => {
    if (studentVal) return studentVal;
    if (globalVal && !globalVal.includes('(Multiple)')) return globalVal;
    return '';
  };

  const handleDownloadCsv = () => {
    if (!data) return;
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Add BOM for Excel
    csvContent += "年度,考區,學校名稱,科組名稱,准考證號,姓名\n";
    
    data.students.forEach((student) => {
      csvContent += `${getRealValue(student.year, data.year)},${getRealValue(student.region, data.region)},${getRealValue(student.schoolName, data.schoolName)},${getRealValue(student.department, data.department)},${student.ticketNumber},${student.name}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${getRealValue('', data.schoolName) || '錄取名單'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToSupabase = async (ignoreDuplicates = false) => {
    if (!data || data.students.length === 0) return;
    
    if (duplicateTickets.size > 0 && !ignoreDuplicates) {
       setShowDuplicateConfirm(true);
       return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      const adminPassword = sessionStorage.getItem('adminPassword');
      if (!adminPassword) {
         setError('請先登入管理員。');
         setIsSaving(false);
         return;
      }

      // Create records payload
      const records = data.students.map(student => ({
        year: getRealValue(student.year, data.year),
        region: getRealValue(student.region, data.region),
        school_name: getRealValue(student.schoolName, data.schoolName),
        department: getRealValue(student.department, data.department),
        gender: data.gender === '多筆資料' ? '' : data.gender,
        ticket_number: student.ticketNumber,
        student_name: student.name
      }));

      // Insert in chunks of 500 to avoid request limits
      const chunkSize = 500;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        
        const response = await fetch('/api/admin/admissions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminPassword
          },
          body: JSON.stringify(chunk)
        });

        if (!response.ok) {
           const errData = await response.json().catch(() => null);
           throw new Error(errData?.error || 'Failed to save to database');
        }
      }
      
      setPopupMessage({
        title: '儲存成功',
        message: `已成功將 ${records.length} 筆資料儲存至資料庫！`,
        type: 'success'
      });
      setSaveSuccess(true);
    } catch (err: any) {
      console.error('API Error:', err);
      setPopupMessage({
        title: '儲存失敗',
        message: `儲存至資料庫時發生錯誤: ${err.message}`,
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMetadataChange = (key: keyof ParsedData, value: string) => {
    if (data) {
      setData({ ...data, [key]: value });
    }
  };

  const handleStudentChange = (idx: number, field: string, value: string) => {
    if (data) {
      const newStudents = [...data.students];
      newStudents[idx] = { ...newStudents[idx], [field]: value } as any;
      setData({ ...data, students: newStudents });
    }
  };

  const handleDeleteStudent = (idx: number) => {
    if (data) {
      const newStudents = data.students.filter((_, i) => i !== idx);
      setData({ ...data, students: newStudents, admittedCount: newStudents.length.toString() });
    }
  };

  const handleAddStudent = () => {
    if (data) {
      const newStudents = [...data.students, { ticketNumber: '', name: '', department: '', _region: '' } as any];
      setData({ ...data, students: newStudents, admittedCount: newStudents.length.toString() });
    }
  };

  const handleToggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!data) return;
    if (e.target.checked) {
      setSelectedIndices(new Set(data.students.map((_, i) => i)));
    } else {
      setSelectedIndices(new Set());
    }
  };

  const handleToggleSelect = (idx: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(idx)) {
      newSet.delete(idx);
    } else {
      newSet.add(idx);
    }
    setSelectedIndices(newSet);
  };

  const handleBulkApply = () => {
    if (!data || selectedIndices.size === 0) return;
    const newStudents = [...data.students];
    for (const idx of selectedIndices) {
      if (bulkYear) newStudents[idx].year = bulkYear;
      if (bulkRegion) newStudents[idx].region = bulkRegion;
      if (bulkSchool) newStudents[idx].schoolName = bulkSchool;
      if (bulkDept) newStudents[idx].department = bulkDept;
    }
    setData({ ...data, students: newStudents });
    setBulkYear('');
    setBulkRegion('');
    setBulkSchool('');
    setBulkDept('');
    setSelectedIndices(new Set()); // Optionally clear selection after apply
  };

  return (
    <div className="flex flex-col h-full w-full bg-transparent">
        
        {/* Header Navigation */}
        <header className="bg-white border-b-4 border-slate-900 z-20">
          <div className="p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="bg-slate-900 text-white w-14 h-14 flex items-center justify-center shrink-0 border-2 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 mb-1">免試入學榜單解析</h1>
                <p className="text-slate-600 text-[11px] sm:text-xs font-bold tracking-wider uppercase">Admission Results Document Parser</p>
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-grow flex flex-col relative">
          
          {!data ? (
            <div className="p-4 sm:p-8 flex flex-col gap-8 flex-grow justify-center items-center relative overflow-hidden bg-white">
              <div className="max-w-2xl w-full brutal-card p-4">
                <div className="flex gap-2 mb-6 border-b-2 border-slate-900 pb-4">
                  <button
                    onClick={() => setActiveTab('upload')}
                    className={`flex-1 py-3 px-3 text-center font-black text-sm transition-all border-2 border-slate-900 ${
                      activeTab === 'upload' ? 'bg-slate-900 text-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-white text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    上傳 PDF
                  </button>
                  <button
                    onClick={() => setActiveTab('text')}
                    className={`flex-1 py-3 px-3 text-center font-black text-sm transition-all border-2 border-slate-900 ${
                      activeTab === 'text' ? 'bg-slate-900 text-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-white text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    貼上文字
                  </button>
                  <button
                    onClick={() => setActiveTab('url')}
                    className={`flex-1 py-3 px-3 text-center font-black text-sm transition-all border-2 border-slate-900 ${
                      activeTab === 'url' ? 'bg-slate-900 text-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-white text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    網址搜尋
                  </button>
                  <button
                    onClick={() => setActiveTab('batch')}
                    className={`flex-1 py-3 px-3 text-center font-black text-sm transition-all border-2 border-slate-900 ${
                      activeTab === 'batch' ? 'bg-slate-900 text-white shadow-[2px_2px_0_0_rgba(15,23,42,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-white text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    批次解析
                  </button>
                </div>

                <div className="p-4">
                  {activeTab === 'upload' && (
                    <div className="flex justify-center px-6 pt-12 pb-14 border-4 border-slate-900 border-dashed bg-white hover:bg-slate-50 transition-all cursor-pointer relative group shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                      <input id="file-upload" name="file-upload" type="file" multiple accept="application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleFileUpload} />
                      <div className="space-y-4 text-center relative z-0">
                        <div className="w-20 h-20 bg-slate-900 flex items-center justify-center mx-auto transition-transform duration-300 group-hover:scale-110">
                          <Upload className="h-10 w-10 text-white" />
                        </div>
                        <div className="flex text-sm justify-center font-black mt-6">
                          <span className="brutal-btn-primary px-8 py-3.5 text-sm pointer-events-none">
                            選擇檔案 Select Files
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-bold tracking-wide mt-4">支援多個 PDF 格式檔案，上限 10MB</p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'text' && (
                    <div className="space-y-5">
                      <textarea
                        rows={8}
                        className="w-full p-4 brutal-input resize-none bg-slate-50"
                        placeholder="將 PDF 內容複製並貼上到這裡..."
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                      />
                      <button
                        onClick={handleTextParse}
                        className="w-full px-6 py-4 brutal-btn-primary text-sm"
                      >
                        開始解析 Parse Text
                      </button>
                    </div>
                  )}

                  {activeTab === 'url' && (
                    <div className="space-y-5">
                      <div className="flex flex-col gap-5">
                        <input
                          type="url"
                          className="w-full p-4 brutal-input bg-slate-50"
                          placeholder="https://example.com/results.pdf"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                        />
                        <button
                          onClick={handleUrlFetch}
                          className="w-full px-6 py-4 brutal-btn-primary text-sm flex items-center justify-center gap-2"
                        >
                          <Search className="w-5 h-5" />
                          搜尋 Search
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'batch' && (
                    <div className="space-y-5">
                      <div className="flex flex-col gap-4">
                        <div className="bg-amber-50 border-4 border-slate-900 p-5 shadow-[4px_4px_0_0_rgba(15,23,42,1)] flex flex-col items-start">
                          <h3 className="text-base font-black text-slate-900 mb-2 flex items-center gap-2">
                            <FileText className="w-5 h-5" /> 批次解析說明
                          </h3>
                          <p className="text-sm text-slate-700 font-bold mb-5 leading-relaxed text-justify">
                            下載範例 CSV 檔案，填入多個榜單 PDF 網址（每行一個），上傳後系統將自動下載並解析所有網址的榜單內容及相關資訊，大幅節省作業時間。
                          </p>
                          <button
                            onClick={handleDownloadBatchTemplate}
                            className="inline-flex items-center justify-center px-5 py-3 text-sm font-black bg-slate-900 text-white hover:bg-slate-800 hover:shadow-[4px_4px_0_0_rgba(251,191,36,1)] hover:-translate-y-1 transition-all active:translate-y-0 active:shadow-none w-full sm:w-auto"
                          >
                            <Download className="w-4 h-4 mr-2" strokeWidth={3} />
                            下載批次範例 CSV
                          </button>
                        </div>
                        
                        <div className="flex justify-center px-6 pt-8 pb-10 border-4 border-slate-900 border-dashed bg-white hover:bg-slate-50 transition-all cursor-pointer relative group shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                          <input id="batch-upload" name="batch-upload" type="file" accept=".csv" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={handleBatchCsvUpload} />
                          <div className="space-y-4 text-center relative z-0">
                            <div className="w-16 h-16 bg-slate-900 flex items-center justify-center mx-auto transition-transform duration-300 group-hover:scale-110">
                              <FileText className="h-8 w-8 text-white" />
                            </div>
                            <div className="flex text-sm justify-center font-black mt-4">
                              <span className="brutal-btn-primary px-6 py-2.5 text-sm pointer-events-none">
                                上傳批次 CSV
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="mt-6 p-4 bg-white border-4 border-slate-900 flex items-start gap-3 shadow-[4px_4px_0_0_rgba(239,68,68,1)]">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <p className="text-sm font-black text-slate-900 leading-relaxed">{error}</p>
                    </div>
                  )}
                  
                  {loading && (
                    <div className="mt-8 py-12 flex flex-col items-center justify-center space-y-6 bg-white border-4 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                      <div className="animate-spin h-12 w-12 border-4 border-slate-900 border-t-transparent"></div>
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-sm font-black text-slate-900 tracking-wider">正在解析榜單資料中</p>
                        <p className="text-xs font-bold text-slate-600">運用智能算法深度分析...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full bg-white">
              
              {/* Top Summary Info Panel */}
              <div className="p-4 sm:p-8 pb-0">
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
                <div className="bg-slate-50 p-4 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] flex flex-col justify-center xl:col-span-1">
                  <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1.5">年度 Year</label>
                  <input
                    type="text"
                    value={data.year}
                    onChange={(e) => handleMetadataChange('year', e.target.value)}
                    className="w-full text-base sm:text-lg font-black text-slate-900 bg-transparent outline-none placeholder:text-slate-400"
                    placeholder="未找到"
                  />
                </div>
                
                <div className="bg-slate-50 p-4 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] flex flex-col justify-center xl:col-span-1">
                  <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1.5">考區 Region</label>
                  <input
                    type="text"
                    value={data.region}
                    onChange={(e) => handleMetadataChange('region', e.target.value)}
                    className="w-full text-base sm:text-lg font-black text-slate-900 bg-transparent outline-none placeholder:text-slate-400"
                    placeholder="未找到"
                  />
                </div>

                <div className="bg-slate-50 p-4 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] flex flex-col justify-center xl:col-span-1">
                  <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1.5">招生性別 Gender</label>
                  <input
                    type="text"
                    value={data.gender}
                    onChange={(e) => handleMetadataChange('gender', e.target.value)}
                    className="text-base sm:text-lg font-black text-slate-900 bg-transparent outline-none placeholder:text-slate-400 w-full"
                    placeholder="未註明"
                  />
                </div>

                <div className="bg-blue-100 p-4 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] flex flex-col justify-center xl:col-span-1">
                  <label className="block text-[10px] font-black text-blue-900 uppercase tracking-widest mb-1.5">錄取人數 Admissions</label>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-blue-700">
                      {data.students.length}
                    </span>
                    <span className="text-sm font-bold text-blue-900">名</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] flex flex-col justify-center col-span-2 md:col-span-2 xl:col-span-2">
                  <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1.5">學校名稱 School Name</label>
                  <input
                    type="text"
                    value={data.schoolName}
                    onChange={(e) => handleMetadataChange('schoolName', e.target.value)}
                    className="w-full text-base sm:text-lg font-black text-slate-900 bg-transparent outline-none placeholder:text-slate-400"
                    placeholder="未找到"
                  />
                </div>

                <div className="bg-slate-50 p-4 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] flex flex-col justify-center col-span-2 md:col-span-2 xl:col-span-2">
                  <label className="block text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1.5">科組名稱 Department</label>
                  <input
                    type="text"
                    value={data.department}
                    onChange={(e) => handleMetadataChange('department', e.target.value)}
                    className="w-full text-base sm:text-lg font-black text-slate-900 bg-transparent outline-none placeholder:text-slate-400"
                    placeholder="未找到"
                  />
                </div>
              </div>
              </div>

              {/* Main Data Grid Area */}
              <div className="flex-grow p-4 sm:p-8 flex flex-col overflow-x-hidden">
                <div className="mb-4 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 px-2 border-b-4 border-slate-900 pb-2">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-wide">錄取名單 <span className="text-slate-500 font-bold text-sm ml-2">({data.students.length} 筆資料)</span></h2>
                  </div>
                                    <div className="grid grid-cols-2 md:flex md:flex-row md:flex-wrap items-center justify-start xl:justify-end gap-3 w-full xl:w-auto mt-4 xl:mt-0">
                    <div className="col-span-2 flex items-center justify-center gap-2 border-2 border-slate-900 bg-slate-50 p-1.5 shadow-[4px_4px_0_0_rgba(15,23,42,1)] w-full md:w-auto">
                      <button
                        onClick={handleDownloadTemplate}
                        className="flex-1 md:flex-none inline-flex items-center justify-center px-3 py-1.5 text-xs sm:text-sm font-bold bg-white text-slate-700 hover:bg-slate-200 transition-colors border-2 border-transparent hover:border-slate-900"
                        title="下載模板"
                      >
                        <Download className="w-4 h-4 mr-1.5" />
                        <span>下載模板</span>
                      </button>
                      <div className="w-0.5 h-6 bg-slate-300"></div>
                      <label className="flex-1 md:flex-none inline-flex items-center justify-center px-3 py-1.5 text-xs sm:text-sm font-bold bg-white text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer border-2 border-transparent hover:border-slate-900" title="匯入 CSV">
                        <Upload className="w-4 h-4 mr-1.5" />
                        <span>匯入 CSV</span>
                        <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
                      </label>
                    </div>

                    <button
                      onClick={() => handleSaveToSupabase(false)}
                      disabled={isSaving}
                      className="col-span-2 md:col-span-1 w-full md:w-auto inline-flex items-center justify-center px-4 py-2.5 text-sm font-black bg-blue-600 text-white border-2 border-slate-900 hover:bg-blue-700 transition-all shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                    >
                      <Database className="w-4 h-4 mr-2" />
                      {isSaving ? '儲存中...' : '儲存至資料庫'}
                    </button>

                    <button
                      onClick={handleDownloadCsv}
                      className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2.5 text-sm font-black bg-white text-slate-900 border-2 border-slate-900 hover:bg-slate-100 transition-all shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      匯出 CSV
                    </button>

                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2.5 text-sm font-black bg-red-100 text-red-700 border-2 border-slate-900 hover:bg-red-200 transition-all shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      重新開始
                    </button>
                  </div>
                </div>
                
                {/* Bulk Edit Bar */}
                {selectedIndices.size > 0 && (
                  <div className="mb-4 p-4 bg-slate-100 border-2 border-slate-900 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                    <span className="text-sm font-black text-slate-900 w-full sm:w-auto">已選擇 {selectedIndices.size} 筆資料：</span>
                    <div className="flex flex-wrap gap-2 flex-grow">
                      <input 
                        type="text" 
                        placeholder="修改年度" 
                        value={bulkYear} 
                        onChange={e => setBulkYear(e.target.value)} 
                        className="p-2 text-sm border-2 border-slate-300 focus:border-slate-900 outline-none flex-1 min-w-[80px]"
                      />
                      <input 
                        type="text" 
                        placeholder="修改考區" 
                        value={bulkRegion} 
                        onChange={e => setBulkRegion(e.target.value)} 
                        className="p-2 text-sm border-2 border-slate-300 focus:border-slate-900 outline-none flex-1 min-w-[80px]"
                      />
                      <input 
                        type="text" 
                        placeholder="修改學校名稱" 
                        value={bulkSchool} 
                        onChange={e => setBulkSchool(e.target.value)} 
                        className="p-2 text-sm border-2 border-slate-300 focus:border-slate-900 outline-none flex-1 min-w-[120px]"
                      />
                      <input 
                        type="text" 
                        placeholder="修改科組名稱" 
                        value={bulkDept} 
                        onChange={e => setBulkDept(e.target.value)} 
                        className="p-2 text-sm border-2 border-slate-300 focus:border-slate-900 outline-none flex-1 min-w-[120px]"
                      />
                    </div>
                    <button 
                      onClick={handleBulkApply}
                      className="px-4 py-2 text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors w-full sm:w-auto mt-2 sm:mt-0"
                    >
                      批量套用
                    </button>
                  </div>
                )}

                <div className="overflow-x-auto w-full bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead className="bg-slate-900 text-white border-b-4 border-slate-900">
                      <tr>
                        <th className="p-4 pl-6 w-12">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 accent-slate-900 cursor-pointer"
                            checked={data.students.length > 0 && selectedIndices.size === data.students.length}
                            onChange={handleToggleSelectAll}
                          />
                        </th>
                        <th className="p-4 text-[11px] font-black uppercase tracking-wider whitespace-nowrap">年度</th>
                        <th className="p-4 text-[11px] font-black uppercase tracking-wider whitespace-nowrap">考區</th>
                        <th className="p-4 text-[11px] font-black uppercase tracking-wider whitespace-nowrap">學校名稱</th>
                        <th className="p-4 text-[11px] font-black uppercase tracking-wider whitespace-nowrap">科組名稱</th>
                        <th className="p-4 text-[11px] font-black uppercase tracking-wider whitespace-nowrap">准考證號</th>
                        <th className="p-4 pr-6 text-[11px] font-black uppercase tracking-wider whitespace-nowrap">姓名</th>
                        <th className="p-4 pr-6 text-[11px] font-black uppercase tracking-wider whitespace-nowrap text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-200">
                      {data.students.map((student, idx) => (
                        <tr key={idx} className={`transition-colors ${
                          selectedIndices.has(idx) 
                            ? 'bg-blue-50 hover:bg-blue-100' 
                            : student.ticketNumber && duplicateTickets.has(student.ticketNumber)
                              ? 'bg-rose-100 hover:bg-rose-200 border-l-4 border-rose-500'
                              : 'hover:bg-slate-100'
                        }`}>
                          <td className="p-4 pl-6 w-12">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 accent-slate-900 cursor-pointer"
                              checked={selectedIndices.has(idx)}
                              onChange={() => handleToggleSelect(idx)}
                            />
                          </td>
                          <td className="p-2 text-sm font-bold text-slate-600">
                            <input 
                              className="bg-transparent w-full p-2 border-b-2 border-transparent hover:border-slate-300 focus:border-slate-900 outline-none transition-colors" 
                              value={student.year || ''} 
                              onChange={e => handleStudentChange(idx, 'year', e.target.value)}
                              placeholder={data.year || '-'}
                            />
                          </td>
                          <td className="p-2 text-sm font-bold text-slate-600">
                            <input 
                              className="bg-transparent w-full p-2 border-b-2 border-transparent hover:border-slate-300 focus:border-slate-900 outline-none transition-colors" 
                              value={student.region || ''} 
                              onChange={e => handleStudentChange(idx, 'region', e.target.value)}
                              placeholder={data.region || '-'}
                            />
                          </td>
                          <td className="p-2 text-sm font-bold text-slate-900">
                            <input 
                              className="bg-transparent w-full p-2 border-b-2 border-transparent hover:border-slate-300 focus:border-slate-900 outline-none transition-colors" 
                              value={student.schoolName || ''} 
                              onChange={e => handleStudentChange(idx, 'schoolName', e.target.value)}
                              placeholder={data.schoolName || '-'}
                            />
                          </td>
                          <td className="p-2 text-sm font-bold text-slate-800">
                            <input 
                              className="bg-transparent w-full p-2 border-b-2 border-transparent hover:border-slate-300 focus:border-slate-900 outline-none transition-colors" 
                              value={student.department || ''} 
                              onChange={e => handleStudentChange(idx, 'department', e.target.value)}
                              placeholder={data.department || '-'}
                            />
                          </td>
                          <td className="p-2 text-sm font-mono font-bold text-slate-600">
                            <input 
                              className="bg-transparent w-full p-2 border-b-2 border-transparent hover:border-slate-300 focus:border-slate-900 outline-none transition-colors" 
                              value={student.ticketNumber || ''} 
                              onChange={e => handleStudentChange(idx, 'ticketNumber', e.target.value)}
                              placeholder="-"
                            />
                          </td>
                          <td className="p-2 pr-6 text-sm font-black text-slate-900">
                            <input 
                              className="bg-transparent w-full p-2 border-b-2 border-transparent hover:border-slate-300 focus:border-slate-900 outline-none transition-colors" 
                              value={student.name || ''} 
                              onChange={e => handleStudentChange(idx, 'name', e.target.value)}
                              placeholder="-"
                            />
                          </td>
                          <td className="p-2 pr-6 text-sm font-black text-right">
                            <button 
                              onClick={() => handleDeleteStudent(idx)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="移除此筆"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <div className="p-4 border-t-2 border-slate-200 flex justify-center bg-slate-50">
                    <button 
                      onClick={handleAddStudent}
                      className="text-sm font-black text-slate-600 hover:text-slate-900 flex items-center gap-2 px-4 py-2 hover:bg-slate-200 transition-colors"
                    >
                      <span>+ 新增一筆資料</span>
                    </button>
                  </div>
                  
                  {data.students.length === 0 && (
                    <div className="w-full py-20 flex flex-col items-center justify-center bg-slate-50 border-t-2 border-slate-900">
                      <p className="text-slate-900 font-black tracking-wide text-sm">未找到任何符合格式的准考證號與姓名</p>
                      <p className="text-xs text-slate-600 mt-2 font-bold">請確認 PDF 格式或嘗試貼上純文字</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Details */}
              <footer className="mt-auto border-t-4 border-slate-900 bg-white p-4 flex justify-end z-10">
                <div className="text-[11px] font-bold text-slate-500">
                  Data processing completed
                </div>
              </footer>

            </div>
          )}
        </main>

        {popupMessage && (
          <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
            <div className={`bg-white border-4 border-slate-900 p-6 max-w-md w-full shadow-[8px_8px_0_0_rgba(15,23,42,1)] ${
              popupMessage.type === 'success' ? 'border-t-8 border-t-emerald-500' : 
              popupMessage.type === 'error' ? 'border-t-8 border-t-rose-500' : 
              'border-t-8 border-t-amber-500'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  {popupMessage.type === 'success' ? (
                    <CheckCircle className="w-6 h-6 text-emerald-500" strokeWidth={3} />
                  ) : (
                    <AlertTriangle className={`w-6 h-6 ${popupMessage.type === 'error' ? 'text-rose-500' : 'text-amber-500'}`} strokeWidth={3} />
                  )}
                  <h3 className="text-xl font-black text-slate-900">{popupMessage.title}</h3>
                </div>
                <button onClick={() => setPopupMessage(null)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-slate-600 font-bold mb-6">{popupMessage.message}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => setPopupMessage(null)}
                  className="px-6 py-2 bg-slate-900 text-white font-black text-sm hover:bg-slate-800 transition-all shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                >
                  我知道了
                </button>
              </div>
            </div>
          </div>
        )}

        {showFailedBatchModal && failedBatchUrls.length > 0 && (
          <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white border-4 border-slate-900 p-6 max-w-lg w-full shadow-[8px_8px_0_0_rgba(15,23,42,1)] border-t-8 border-t-rose-500">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-rose-500" strokeWidth={3} />
                  <h3 className="text-xl font-black text-slate-900">批次解析失敗清單</h3>
                </div>
                <button onClick={() => setShowFailedBatchModal(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="text-slate-600 font-bold mb-4 text-sm">
                以下 {failedBatchUrls.length} 個網址在批次解析時發生錯誤或無法讀取：
              </div>
              <div className="max-h-60 overflow-y-auto border-2 border-slate-200 p-3 mb-6 bg-slate-50 font-mono text-xs">
                {failedBatchUrls.map((url, idx) => (
                  <div key={idx} className="mb-1 text-slate-700 break-all border-b border-slate-200 pb-1 last:border-0 last:pb-0">
                    {url}
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowFailedBatchModal(false)}
                  className="px-6 py-2 bg-slate-900 text-white font-black text-sm hover:bg-slate-800 transition-all shadow-[4px_4px_0_0_rgba(15,23,42,1)]"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        )}

        {showDuplicateConfirm && (
          <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white border-4 border-slate-900 p-6 max-w-sm w-full shadow-[8px_8px_0_0_rgba(15,23,42,1)] border-t-8 border-t-rose-500">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-rose-500" strokeWidth={3} />
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">確定要移除重複資料？</h3>
                </div>
              </div>
              <p className="text-slate-600 font-bold text-sm mb-6 leading-relaxed">
                系統偵測到 {duplicateTickets.size} 筆重複的准考證號碼。確定要移除這些重複資料，只保留第一筆嗎？
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDuplicateConfirm(false)}
                  className="px-4 py-2 bg-white text-slate-700 font-black text-sm border-2 border-slate-900 hover:bg-slate-50 transition-all shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setShowDuplicateConfirm(false);
                    handleSaveToSupabase(true);
                  }}
                  className="px-4 py-2 bg-amber-500 text-slate-900 font-black text-sm border-2 border-slate-900 hover:bg-amber-600 transition-all shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                >
                  略過並儲存
                </button>
                <button
                  onClick={handleRemoveDuplicates}
                  className="px-4 py-2 bg-rose-500 text-white font-black text-sm border-2 border-slate-900 hover:bg-rose-600 transition-all shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                >
                  確定移除
                </button>
              </div>
            </div>
          </div>
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white border-4 border-slate-900 p-6 max-w-sm w-full shadow-[8px_8px_0_0_rgba(15,23,42,1)] border-t-8 border-t-amber-500">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-amber-500" strokeWidth={3} />
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">確定要重新開始？</h3>
                </div>
              </div>
              <p className="text-slate-600 font-bold text-sm mb-6 leading-relaxed">
                重新開始將會清空目前所有已解析的榜單資料，確定要繼續嗎？
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 bg-white text-slate-700 font-black text-sm border-2 border-slate-900 hover:bg-slate-50 transition-all shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setShowResetConfirm(false);
                    setData(null);
                  }}
                  className="px-4 py-2 bg-amber-500 text-slate-900 font-black text-sm border-2 border-slate-900 hover:bg-amber-400 transition-all shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                >
                  確定重新開始
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'parser' | 'database' | 'stats'>('parser');

  const handleTabChange = (tab: 'parser' | 'database' | 'stats') => {
    if (activeTab === 'parser' && tab !== 'parser' && window.hasUnsavedData) {
      const confirmLeave = window.confirm('您有尚未儲存的解析資料，確定要離開嗎？資料將會遺失。');
      if (!confirmLeave) return;
    }
    setActiveTab(tab);
  };

  if (!isAuthenticated) {
    return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="w-full max-w-6xl brutal-card flex flex-col overflow-hidden min-h-[calc(100vh-8rem)]">
      <div className="flex bg-slate-100 p-4 gap-4 border-b-4 border-slate-900 z-20 flex-wrap sm:flex-nowrap">
        <button
          onClick={() => handleTabChange('parser')}
          className={`flex-1 py-3 px-4 text-sm font-black transition-all border-2 border-slate-900 ${
            activeTab === 'parser' 
              ? 'bg-slate-900 text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] translate-x-[-2px] translate-y-[-2px]' 
              : 'bg-white text-slate-900 hover:bg-slate-50'
          }`}
        >
          解析器 Parser
        </button>
        <button
          onClick={() => handleTabChange('database')}
          className={`flex-1 py-3 px-4 text-sm font-black transition-all border-2 border-slate-900 ${
            activeTab === 'database' 
              ? 'bg-slate-900 text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] translate-x-[-2px] translate-y-[-2px]' 
              : 'bg-white text-slate-900 hover:bg-slate-50'
          }`}
        >
          資料庫管理 Database
        </button>
        <button
          onClick={() => handleTabChange('stats')}
          className={`flex-1 py-3 px-4 text-sm font-black transition-all border-2 border-slate-900 ${
            activeTab === 'stats' 
              ? 'bg-slate-900 text-white shadow-[4px_4px_0_0_rgba(15,23,42,1)] translate-x-[-2px] translate-y-[-2px]' 
              : 'bg-white text-slate-900 hover:bg-slate-50'
          }`}
        >
          統計分析 Analytics
        </button>
      </div>
      <div className="flex-grow flex flex-col relative bg-white h-full">
        {activeTab === 'parser' ? <ParserTool /> : activeTab === 'database' ? <AdminDatabase /> : <AdminStats />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<QueryPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/schools" element={<SchoolListPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/disclaimer" element={<DisclaimerPage />} />
      </Routes>
    </Layout>
  );
}
