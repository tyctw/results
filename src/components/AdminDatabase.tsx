import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase, AdmissionRecord } from '../lib/supabase';
import { NATIONAL_SCHOOLS } from '../lib/nationalSchools';
import { Settings, Key, Trash2, RefreshCw, AlertCircle, Loader2, Database, X, Edit2, Save, User, MapPin, Calendar, Building2, Hash, Clock, BookOpen, Fingerprint, AlertTriangle, Search, Download, FileText, Upload, Cloud } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';

export default function AdminDatabase() {
  const [records, setRecords] = useState<AdmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [duplicateTickets, setDuplicateTickets] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteInput, setBulkDeleteInput] = useState('');
  const [showDeduplicateModal, setShowDeduplicateModal] = useState(false);
  const [deduplicateInput, setDeduplicateInput] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showDeleteConfirmId, setShowDeleteConfirmId] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<AdmissionRecord | null>(null);
  const [editForm, setEditForm] = useState<Partial<AdmissionRecord>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showDownloadCsvModal, setShowDownloadCsvModal] = useState(false);
  const [isDownloadingCsv, setIsDownloadingCsv] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'overwrite' | 'merge'>('overwrite');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreProgress, setRestoreProgress] = useState(0);

  const [showCloudBackupModal, setShowCloudBackupModal] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<any[]>([]);
  const [isSyncingBackup, setIsSyncingBackup] = useState(false);
  const [isRestoringFromCloud, setIsRestoringFromCloud] = useState(false);

  const fetchCloudBackups = async () => {
    try {
      const adminPassword = sessionStorage.getItem('adminPassword');
      const response = await fetch('/api/admin/backups', {
        headers: { 'x-admin-password': adminPassword || '' }
      });
      if (!response.ok) throw new Error('Failed to fetch backups');
      const data = await response.json();
      setCloudBackups(data.backups || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncBackup = async () => {
    setIsSyncingBackup(true);
    setError(null);
    try {
      let allData: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('admissions')
          .select('*')
          .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
          
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        currentPage++;
      }
      
      const adminPassword = sessionStorage.getItem('adminPassword');
      const dateStr = new Date().toISOString();
      const response = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword || ''
        },
        body: JSON.stringify({
          file_name: `admissions_backup_${dateStr}.json`,
          backup_data: allData
        })
      });
      
      if (!response.ok) throw new Error('同步備份失敗');
      
      await fetchCloudBackups();
      alert('雲端同步備份成功！');
    } catch (err: any) {
      console.error('Cloud backup failed:', err);
      alert(err.message || '備份失敗');
    } finally {
      setIsSyncingBackup(false);
    }
  };

  const handleRestoreFromCloud = async (backupId: number) => {
    if (!window.confirm('確定要從此雲端備份覆寫目前所有資料嗎？這將會先清空目前資料！')) return;
    setIsRestoringFromCloud(true);
    try {
      const adminPassword = sessionStorage.getItem('adminPassword');
      // Fetch backup data
      const fetchResponse = await fetch(`/api/admin/backups/${backupId}`, {
        headers: { 'x-admin-password': adminPassword || '' }
      });
      if (!fetchResponse.ok) throw new Error('無法取得備份資料');
      const { backup_data } = await fetchResponse.json();
      
      if (!Array.isArray(backup_data)) throw new Error('備份資料格式錯誤');
      
      // Clear current data
      const delResponse = await fetch('/api/admin/admissions', {
        method: 'DELETE',
        headers: { 'x-admin-password': adminPassword || '' }
      });
      if (!delResponse.ok) throw new Error('清空目前資料庫失敗');

      // Upload in chunks
      const chunkSize = 500;
      for (let i = 0; i < backup_data.length; i += chunkSize) {
        const chunk = backup_data.slice(i, i + chunkSize);
        const uploadResponse = await fetch('/api/admin/admissions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminPassword || ''
          },
          body: JSON.stringify(chunk)
        });
        if (!uploadResponse.ok) throw new Error(`上傳資料失敗 (批次 ${i / chunkSize + 1})`);
      }
      
      setShowCloudBackupModal(false);
      fetchRecords(true);
      alert('雲端還原完成！');
    } catch (err: any) {
      console.error('Cloud restore failed:', err);
      alert(err.message || '還原失敗');
    } finally {
      setIsRestoringFromCloud(false);
    }
  };


  
  // Batch Operations
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [batchEditForm, setBatchEditForm] = useState<Partial<AdmissionRecord>>({});
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  
  // Filters
  const [filterKeyword, setFilterKeyword] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterTicket, setFilterTicket] = useState('');
  const [filterOnlyDuplicates, setFilterOnlyDuplicates] = useState(false);
  const [globalDuplicateTickets, setGlobalDuplicateTickets] = useState<string[]>([]);
  const [stats, setStats] = useState({ 
    schools: 0, 
    departments: 0,
    regions: 0,
    years: 0,
    male: 0,
    female: 0
  });

  const fetchStats = async () => {
    try {
      let allData: any[] = [];
      let page = 0;
      const statPageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('admissions')
          .select('school_name, department, region, year, gender, ticket_number')
          .range(page * statPageSize, (page + 1) * statPageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < statPageSize) break;
        page++;
      }
      
      if (allData.length > 0) {
        const data = allData;
        const uniqueSchools = new Set(data.map(d => d.school_name).filter(Boolean)).size;
        const uniqueDepartments = new Set(data.map(d => `${d.school_name}-${d.department}`).filter(d => d !== '-')).size;
        const uniqueRegions = new Set(data.map(d => d.region).filter(Boolean)).size;
        const uniqueYears = new Set(data.map(d => d.year).filter(Boolean)).size;
        const maleCount = data.filter(d => d.gender === '男').length;
        const femaleCount = data.filter(d => d.gender === '女').length;
        
        const ticketCounts = new Map<string, number>();
        for (const d of data) {
          if (d.ticket_number) {
            ticketCounts.set(d.ticket_number, (ticketCounts.get(d.ticket_number) || 0) + 1);
          }
        }
        const gDupes: string[] = [];
        for (const [t, c] of ticketCounts.entries()) {
          if (c > 1) gDupes.push(t);
        }
        setGlobalDuplicateTickets(gDupes);

        setStats({ 
          schools: uniqueSchools, 
          departments: uniqueDepartments,
          regions: uniqueRegions,
          years: uniqueYears,
          male: maleCount,
          female: femaleCount
        });
      }
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  };

  const handleOpenDownloadModal = () => {
    setShowDownloadCsvModal(true);
  };

  const executeDownloadCSV = async (type: 'hasList' | 'noList' | 'combined') => {
    setIsDownloadingCsv(true);
    try {
      let allData: any[] = [];
      let currentPage = 0;
      const statPageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('admissions')
          .select('school_name, department, region, year')
          .range(currentPage * statPageSize, (currentPage + 1) * statPageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < statPageSize) break;
        currentPage++;
      }

      const schoolsInDb = new Set<string>();
      allData.forEach(d => {
        if (d.school_name) {
          schoolsInDb.add(d.school_name);
        }
      });

      let csvContent = '\uFEFF';
      let filename = '全國高中職收錄情形.csv';

      if (type === 'hasList') {
        // Detailed list of those that have admissions
        csvContent += '年份,考區,學校,科系,錄取人數\n';
        const map = new Map<string, number>();
        allData.forEach(d => {
          const key = `${d.year || ''},${d.region || ''},${d.school_name || ''},${d.department || ''}`;
          map.set(key, (map.get(key) || 0) + 1);
        });
        Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([key, count]) => {
          const row = key.split(',').map(v => `"${v}"`).join(',');
          csvContent += `${row},${count}\n`;
        });
        filename = '已收錄榜單學校明細.csv';
      } else if (type === 'noList') {
        csvContent += '考區,學校代碼,學校名稱\n';
        NATIONAL_SCHOOLS.forEach(ns => {
          if (!schoolsInDb.has(ns.name)) {
            csvContent += `"${ns.region}","${ns.code}","${ns.name}"\n`;
          }
        });
        filename = '尚未收錄榜單學校.csv';
      } else if (type === 'combined') {
        csvContent += '考區,學校代碼,學校名稱,收錄狀態\n';
        NATIONAL_SCHOOLS.forEach(ns => {
          const status = schoolsInDb.has(ns.name) ? '已收錄' : '尚未收錄';
          csvContent += `"${ns.region}","${ns.code}","${ns.name}","${status}"\n`;
        });
        filename = '全國高中職收錄統整.csv';
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowDownloadCsvModal(false);
    } catch (err) {
      console.error("Failed to generate CSV", err);
      setError('下載 CSV 失敗');
    } finally {
      setIsDownloadingCsv(false);
    }
  };

  const fetchRecords = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
      fetchStats();
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      let query = supabase
        .from('admissions')
        .select('*', { count: 'exact' });

      if (filterKeyword) {
        query = query.or(`school_name.ilike.%${filterKeyword}%,department.ilike.%${filterKeyword}%,ticket_number.ilike.%${filterKeyword}%,student_name.ilike.%${filterKeyword}%`);
      }
      if (filterSchool) query = query.ilike('school_name', `%${filterSchool}%`);
      if (filterDepartment) query = query.ilike('department', `%${filterDepartment}%`);
      if (filterTicket) query = query.ilike('ticket_number', `%${filterTicket}%`);
      
      if (filterOnlyDuplicates) {
        if (globalDuplicateTickets.length > 0) {
          query = query.in('ticket_number', globalDuplicateTickets);
        } else {
          setRecords([]);
          setTotalCount(0);
          setDuplicateTickets(new Set());
          setLoading(false);
          setIsRefreshing(false);
          return;
        }
      }

      const { data, error: sbError, count } = await query
        .order('id', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (sbError) throw sbError;
      
      setRecords(data || []);
      if (count !== null) setTotalCount(count);

      // 檢查重複資料
      if (data && data.length > 0) {
        const tickets = data.map(d => d.ticket_number).filter(Boolean);
        if (tickets.length > 0) {
          const { data: allMatches } = await supabase
            .from('admissions')
            .select('ticket_number')
            .in('ticket_number', tickets);
            
          if (allMatches) {
            const counts: Record<string, number> = {};
            allMatches.forEach(m => {
               if (m.ticket_number) {
                 counts[m.ticket_number] = (counts[m.ticket_number] || 0) + 1;
               }
            });
            const duplicates = new Set<string>();
            Object.keys(counts).forEach(k => {
               if (counts[k] > 1) duplicates.add(k);
            });
            setDuplicateTickets(duplicates);
          }
        }
      } else {
        setDuplicateTickets(new Set());
      }
    } catch (err: any) {
      setError(err.message || '無法載入資料');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setPage(0);
    fetchRecords();
  }, [filterKeyword, filterSchool, filterDepartment, filterTicket, filterOnlyDuplicates]);

  // Reset to first page when page size changes
  useEffect(() => {
    if (page !== 0) {
      setPage(0);
    } else {
      fetchRecords();
    }
  }, [pageSize]);

  useEffect(() => {
    fetchRecords();
  }, [page]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setShowDeleteConfirmId(null);
    try {
      const adminPassword = sessionStorage.getItem('adminPassword');
      const response = await fetch(`/api/admin/admissions/${id}`, {
        method: 'DELETE',
        headers: {
          'x-admin-password': adminPassword || ''
        }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to delete');
      }
      setRecords(records.filter(r => r.id !== id));
      setTotalCount(prev => prev - 1);
      // Re-evaluate duplicates (lazy way: just remove from list, might still be duplicate if > 2, but fine for now)
      fetchRecords(); 
    } catch (err: any) {
      setError('刪除失敗: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (bulkDeleteInput !== 'DELETE') return;
    
    setShowBulkDeleteModal(false);
    setLoading(true);
    try {
      const adminPassword = sessionStorage.getItem('adminPassword');
      const response = await fetch(`/api/admin/admissions`, {
        method: 'DELETE',
        headers: {
          'x-admin-password': adminPassword || ''
        }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to bulk delete');
      }
      setPage(0);
      fetchRecords();
    } catch (err: any) {
      setError('清空失敗: ' + err.message);
      setLoading(false);
    }
  };

  const [deduplicateSuccessMessage, setDeduplicateSuccessMessage] = useState<string | null>(null);

  const executeDeduplicate = async () => {
    setShowDeduplicateModal(false);
    setLoading(true);
    try {
      const adminPassword = sessionStorage.getItem('adminPassword');
      const response = await fetch(`/api/admin/admissions/deduplicate`, {
        method: 'POST',
        headers: {
          'x-admin-password': adminPassword || ''
        }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to deduplicate');
      }
      const data = await response.json();
      setDeduplicateSuccessMessage(`已成功刪除 ${data.count} 筆重複資料！`);
      setPage(0);
      fetchRecords(true);
    } catch (err: any) {
      setError('刪除重複失敗: ' + err.message);
      setLoading(false);
    }
  };

  const handleEditClick = (record: AdmissionRecord) => {
    setEditingRecord(record);
    setEditForm(record);
  };

  const handleCloseEdit = () => {
    if (editingRecord) {
      const hasChanges = Object.keys(editForm).some(
        (key) => editForm[key as keyof AdmissionRecord] !== editingRecord[key as keyof AdmissionRecord]
      );
      if (hasChanges) {
        const confirmLeave = window.confirm('您有尚未儲存的變更，確定要取消嗎？變更將會遺失。');
        if (!confirmLeave) return;
      }
    }
    setEditingRecord(null);
  };

  const handleSaveEdit = async () => {
    if (!editingRecord || !editingRecord.id) return;
    setIsSavingEdit(true);
    setError(null);
    try {
      const adminPassword = sessionStorage.getItem('adminPassword');
      const response = await fetch(`/api/admin/admissions/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword || ''
        },
        body: JSON.stringify({
          year: editForm.year,
          region: editForm.region,
          school_name: editForm.school_name,
          department: editForm.department,
          ticket_number: editForm.ticket_number,
          student_name: editForm.student_name,
          gender: editForm.gender,
        })
      });
        
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to update');
      }
      
      setRecords(records.map(r => r.id === editingRecord.id ? { ...r, ...editForm } : r));
      setEditingRecord(null);
    } catch (err: any) {
      setError('更新失敗: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setShowBatchDeleteModal(false);
    setLoading(true);
    try {
      const adminPassword = sessionStorage.getItem('adminPassword');
      const response = await fetch(`/api/admin/admissions/batch-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword || ''
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to batch delete');
      }
      setSelectedIds(new Set());
      fetchRecords(true);
    } catch (err: any) {
      setError('批次刪除失敗: ' + err.message);
      setLoading(false);
    }
  };

  const handleBatchEditSave = async () => {
    if (selectedIds.size === 0) return;
    setIsBatchSaving(true);
    setError(null);
    try {
      const adminPassword = sessionStorage.getItem('adminPassword');
      const updates = {};
      
      // Only include fields that are actually provided in the form
      ['year', 'region', 'school_name', 'department', 'gender'].forEach(field => {
        if (batchEditForm[field as keyof AdmissionRecord] !== undefined && batchEditForm[field as keyof AdmissionRecord] !== '') {
          (updates as any)[field] = batchEditForm[field as keyof AdmissionRecord];
        }
      });
      
      if (Object.keys(updates).length === 0) {
        setShowBatchEditModal(false);
        setIsBatchSaving(false);
        return;
      }
      
      const response = await fetch(`/api/admin/admissions/batch-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword || ''
        },
        body: JSON.stringify({ ids: Array.from(selectedIds), updates })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to batch update');
      }
      
      setShowBatchEditModal(false);
      setSelectedIds(new Set());
      fetchRecords(true);
    } catch (err: any) {
      setError('批次更新失敗: ' + err.message);
    } finally {
      setIsBatchSaving(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length && records.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map(r => r.id!)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };



  const handleRestoreDatabase = async () => {
    if (!restoreFile) {
      setError('請先選擇備份檔案');
      return;
    }
    
    setIsRestoring(true);
    setError(null);
    setRestoreProgress(0);
    
    try {
      const fileContent = await restoreFile.text();
      let records: any[];
      try {
        records = JSON.parse(fileContent);
      } catch (err) {
        throw new Error('無效的 JSON 檔案格式');
      }
      
      if (!Array.isArray(records)) {
        throw new Error('備份檔案內容必須是資料陣列');
      }

      const adminPassword = sessionStorage.getItem('adminPassword');
      
      if (restoreMode === 'overwrite') {
        // Delete all current records
        const delResponse = await fetch('/api/admin/admissions', {
          method: 'DELETE',
          headers: {
            'x-admin-password': adminPassword || ''
          }
        });
        if (!delResponse.ok) {
          throw new Error('清空目前資料庫失敗');
        }
      } else {
        // Merge mode: strip id and created_at to avoid conflicts
        records = records.map(({ id, created_at, ...rest }) => rest);
      }

      // Chunk the records and upload
      const chunkSize = 500;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        
        const uploadResponse = await fetch('/api/admin/admissions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminPassword || ''
          },
          body: JSON.stringify(chunk)
        });
        
        if (!uploadResponse.ok) {
          throw new Error(`上傳資料失敗 (批次 ${i / chunkSize + 1})`);
        }
        
        setRestoreProgress(Math.round(((i + chunk.length) / records.length) * 100));
      }
      
      setShowRestoreModal(false);
      setRestoreFile(null);
      fetchRecords(true); // Refresh
      alert('還原完成！');
    } catch (err: any) {
      console.error('Restore failed:', err);
      setError(err.message || '還原失敗');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleBackupDatabase = async () => {
    setIsBackingUp(true);
    setError(null);
    try {
      let allData: any[] = [];
      let currentPage = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('admissions')
          .select('*')
          .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1);
          
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        currentPage++;
      }
      
      const jsonString = JSON.stringify(allData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `admissions_backup_${dateStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup failed:', err);
      setError(err.message || '備份失敗');
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div className="flex flex-col flex-grow h-full w-full bg-transparent">
      <div className="p-6 sm:p-8 border-b-4 border-slate-900 flex flex-col gap-6 bg-white z-10 relative">
        <div className="relative w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">資料庫管理</h2>
            <button
              onClick={() => setShowChangePasswordModal(true)}
              className="px-3 py-1.5 text-sm font-bold border-2 border-slate-900 bg-slate-100 hover:bg-slate-200 shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] transition-all flex items-center gap-2 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
            >
              <Settings className="w-4 h-4" />
              變更密碼
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 w-full">
            <div className="col-span-2 md:col-span-1 bg-slate-100 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] p-3 flex flex-col justify-center gap-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">總資料</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">{totalCount}</span>
                <span className="text-xs font-bold text-slate-600">筆</span>
              </div>
            </div>
            <div className="bg-blue-50 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] p-3 flex flex-col justify-center gap-1">
              <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">年份</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-blue-900">{stats.years}</span>
                <span className="text-xs font-bold text-blue-700">個</span>
              </div>
            </div>
            <div className="bg-green-50 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] p-3 flex flex-col justify-center gap-1">
              <span className="text-[10px] font-black text-green-800 uppercase tracking-widest">考區</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-green-900">{stats.regions}</span>
                <span className="text-xs font-bold text-green-700">個</span>
              </div>
            </div>
            <div className="bg-yellow-50 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] p-3 flex flex-col justify-center gap-1">
              <span className="text-[10px] font-black text-yellow-800 uppercase tracking-widest">學校</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-yellow-900">{stats.schools}</span>
                <span className="text-xs font-bold text-yellow-700">所</span>
              </div>
            </div>
            <div className="bg-purple-50 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] p-3 flex flex-col justify-center gap-1">
              <span className="text-[10px] font-black text-purple-800 uppercase tracking-widest">科系</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-purple-900">{stats.departments}</span>
                <span className="text-xs font-bold text-purple-700">個</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 relative shrink-0 w-full">
          <button 
            onClick={handleOpenDownloadModal}
            className="flex-1 justify-center px-4 py-2.5 bg-blue-100 border-2 border-slate-900 text-blue-900 text-sm font-black hover:bg-blue-200 transition-all flex items-center gap-2 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            <Download className="w-4 h-4" />下載收錄 CSV
          </button>

          <button 
            onClick={handleBackupDatabase}
            disabled={isBackingUp}
            className="flex-1 justify-center px-4 py-2.5 bg-emerald-100 border-2 border-slate-900 text-emerald-900 text-sm font-black hover:bg-emerald-200 transition-all flex items-center gap-2 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
          >
            {isBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {isBackingUp ? '備份中...' : '備份資料庫'}
          </button>
          <button 
            onClick={() => {
              setRestoreFile(null);
              setRestoreMode('overwrite');
              setRestoreProgress(0);
              setShowRestoreModal(true);
            }}
            disabled={isRefreshing}
            className="flex-1 justify-center px-4 py-2.5 bg-indigo-100 border-2 border-slate-900 text-indigo-900 text-sm font-black hover:bg-indigo-200 transition-all flex items-center gap-2 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
          >
            <Upload className="w-4 h-4" />還原資料庫
          </button>
          <button 
            onClick={() => {
              fetchCloudBackups();
              setShowCloudBackupModal(true);
            }}
            disabled={isRefreshing}
            className="flex-1 justify-center px-4 py-2.5 bg-blue-100 border-2 border-slate-900 text-blue-900 text-sm font-black hover:bg-blue-200 transition-all flex items-center gap-2 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
          >
            <Cloud className="w-4 h-4" />雲端備份
          </button>
          <button 
            onClick={() => {
              setDeduplicateInput('');
              setShowDeduplicateModal(true);
            }}
            disabled={isRefreshing || globalDuplicateTickets.length === 0}
            className="flex-1 justify-center px-4 py-2.5 bg-amber-50 border-2 border-slate-900 text-amber-900 text-sm font-black hover:bg-amber-100 transition-all flex items-center gap-2 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />移除重複 ({globalDuplicateTickets.length})
          </button>
          <button 
            onClick={() => fetchRecords(true)}
            disabled={isRefreshing}
            className="flex-1 justify-center px-4 py-2.5 bg-white border-2 border-slate-900 text-slate-900 text-sm font-black hover:bg-slate-100 transition-all flex items-center gap-2 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-70 disabled:pointer-events-none"
          >
            <RefreshCw className={`w-4 h-4 text-slate-900 ${isRefreshing ? 'animate-spin' : ''}`} />重新整理
          </button>
          <button 
            onClick={() => { setBulkDeleteInput(''); setShowBulkDeleteModal(true); }}
            className="flex-1 justify-center px-4 py-2.5 bg-red-500 border-2 border-slate-900 text-white rounded-none text-sm font-black hover:bg-red-600 transition-all flex items-center gap-2 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
          >
            <Trash2 className="w-4 h-4 text-white" />清空資料庫
          </button>
        </div>
      </div>

      <div className="flex-grow p-4 sm:p-8 relative bg-slate-50 flex flex-col">
        {/* Filters */}
        <div className="mb-6 space-y-4 z-10 relative">
          <div className="w-full relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" strokeWidth={3} />
            </div>
            <input 
              type="text" 
              aria-label="綜合關鍵字搜尋"
              placeholder="綜合關鍵字搜尋 (學生姓名、准考證號、學校、科系)..." 
              value={filterKeyword}
              onChange={(e) => setFilterKeyword(e.target.value)}
              className="w-full h-12 bg-white border-2 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] pl-10 pr-4 py-2 text-base font-black outline-none placeholder:text-slate-400 focus:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="w-full relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" strokeWidth={3} />
            </div>
            <input 
              type="text" 
              aria-label="搜尋學校"
              placeholder="搜尋學校..." 
              value={filterSchool}
              onChange={(e) => setFilterSchool(e.target.value)}
              className="w-full h-11 bg-white border-2 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] pl-9 pr-4 py-2 text-sm font-black outline-none placeholder:text-slate-400 focus:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
            />
          </div>
          <div className="w-full relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" strokeWidth={3} />
            </div>
            <input 
              type="text" 
              aria-label="搜尋科系"
              placeholder="搜尋科系..." 
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full h-11 bg-white border-2 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] pl-9 pr-4 py-2 text-sm font-black outline-none placeholder:text-slate-400 focus:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
            />
          </div>
          <div className="w-full relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" strokeWidth={3} />
            </div>
            <input 
              type="text" 
              aria-label="搜尋准考證"
              placeholder="搜尋准考證..." 
              value={filterTicket}
              onChange={(e) => setFilterTicket(e.target.value)}
              className="w-full h-11 bg-white border-2 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] pl-9 pr-4 py-2 text-sm font-black outline-none placeholder:text-slate-400 focus:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 transition-colors"
            />
          </div>
          </div>
          <div className="w-full">
            <button
              onClick={() => setFilterOnlyDuplicates(!filterOnlyDuplicates)}
              className={`w-full h-11 px-6 py-2 border-2 border-slate-900 text-sm font-black shadow-[4px_4px_0_0_rgba(15,23,42,1)] transition-colors flex items-center justify-center gap-2 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none ${
                filterOnlyDuplicates ? 'bg-amber-500 text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 ${filterOnlyDuplicates ? 'text-slate-900' : 'text-amber-500'}`} strokeWidth={3} />
              {filterOnlyDuplicates ? '顯示全部' : '只顯示重複資料'}
            </button>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowBatchEditModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-black text-sm border-2 border-slate-900 hover:bg-blue-700 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
              >
                <Edit2 className="w-4 h-4" />批次修改 ({selectedIds.size})
              </button>
              <button
                onClick={() => setShowBatchDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-black text-sm border-2 border-slate-900 hover:bg-red-600 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
              >
                <Trash2 className="w-4 h-4" />批次移除 ({selectedIds.size})
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 font-black text-sm border-2 border-slate-900 hover:bg-slate-50 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
              >
                取消選取
              </button>
            </div>
          )}
        </div>

        {loading && records.length === 0 ? (
          <div className="flex justify-center items-center h-64 bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
            <Loader2 className="w-10 h-10 text-slate-900 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-5 bg-white border-4 border-slate-900 text-red-600 flex items-center gap-3 shadow-[4px_4px_0_0_rgba(239,68,68,1)]">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-black text-sm">{error}</span>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-900 bg-white border-4 border-slate-900 border-dashed shadow-[8px_8px_0_0_rgba(15,23,42,1)]">
            <div className="bg-slate-900 p-4 text-white mb-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)] border-2 border-slate-900">
              <Database className="w-8 h-8" />
            </div>
            <p className="font-black tracking-widest text-sm uppercase">資料庫目前沒有任何紀錄</p>
          </div>
        ) : (
          <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[700px]">
            <div className="overflow-auto flex-grow custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-slate-900 text-white border-b-4 border-slate-900 sticky top-0 z-10">
                  <tr>
                    <th className="p-4 pl-6 text-[11px] font-black uppercase tracking-widest whitespace-nowrap w-12">
                      <input 
                        type="checkbox" 
                        checked={records.length > 0 && selectedIds.size === records.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 cursor-pointer accent-blue-600"
                      />
                    </th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest whitespace-nowrap">ID</th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest whitespace-nowrap">年度/考區</th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest whitespace-nowrap">學校科組</th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest whitespace-nowrap">准考證號</th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest whitespace-nowrap">姓名</th>
                    <th className="p-4 text-[11px] font-black uppercase tracking-widest whitespace-nowrap">建立時間</th>
                    <th className="p-4 pr-6 text-[11px] font-black uppercase tracking-widest whitespace-nowrap text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-100 bg-white">
                  {records.map(record => {
                    const isDuplicate = record.ticket_number ? duplicateTickets.has(record.ticket_number) : false;
                    return (
                    <tr key={record.id} className={`hover:bg-slate-50 transition-colors group ${isDuplicate ? 'bg-amber-50/50' : ''} ${selectedIds.has(record.id!) ? 'bg-blue-50/50' : ''}`}>
                      <td className="p-4 pl-6">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.has(record.id!)}
                          onChange={() => toggleSelect(record.id!)}
                          className="w-4 h-4 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center justify-center min-w-[32px] h-8 bg-slate-100 border-2 border-slate-300 text-xs font-mono font-black text-slate-500 rounded-md">
                          {record.id}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black bg-blue-100 text-blue-900 border-2 border-blue-200">
                            <Calendar className="w-3 h-3 mr-1" />
                            {record.year}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black bg-purple-100 text-purple-900 border-2 border-purple-200">
                            <MapPin className="w-3 h-3 mr-1" />
                            {record.region}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
                            <span className="font-black text-slate-900">{record.school_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-colors" />
                            <span className="text-xs font-bold text-slate-600">{record.department}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Hash className={`w-4 h-4 transition-colors ${isDuplicate ? 'text-amber-500' : 'text-slate-400 group-hover:text-slate-700'}`} />
                          <span className={`font-mono font-bold ${isDuplicate ? 'text-amber-700' : 'text-slate-700'}`}>{record.ticket_number}</span>
                          {isDuplicate && (
                             <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 ml-1 shadow-[2px_2px_0_0_rgba(217,119,6,1)]">
                               <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                               重複
                             </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
                          <span className="font-black text-slate-900">{record.student_name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-xs font-bold">{new Date(record.created_at || '').toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="p-4 pr-6 text-right relative">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditClick(record)}
                            className="p-2.5 text-slate-600 hover:text-slate-900 bg-white border-2 border-transparent hover:border-slate-900 hover:bg-blue-50 transition-all hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                            title="編輯紀錄"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => record.id && setShowDeleteConfirmId(record.id)}
                            disabled={deletingId === record.id}
                            className="p-2.5 text-slate-400 hover:text-red-600 bg-white border-2 border-transparent hover:border-slate-900 hover:bg-red-50 transition-all disabled:opacity-50 hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)]"
                            title="刪除紀錄"
                          >
                            {deletingId === record.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 sm:p-5 border-t-4 border-slate-900 flex flex-wrap sm:flex-nowrap justify-between items-center gap-4 bg-white">
              <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto">
                <span className="text-xs font-black text-slate-900 tracking-widest bg-slate-100 px-5 py-2.5 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] text-center">
                  PAGE <span>{page + 1}</span> OF <span>{Math.ceil(totalCount / pageSize) || 1}</span>
                </span>
                <select 
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-white border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)] py-2 px-3 text-sm font-black text-slate-900 outline-none hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <option value={10}>10 筆/頁</option>
                  <option value={20}>20 筆/頁</option>
                  <option value={50}>50 筆/頁</option>
                  <option value={100}>100 筆/頁</option>
                  <option value={200}>200 筆/頁</option>
                  <option value={500}>500 筆/頁</option>
                </select>
              </div>
              <div className="flex w-full sm:w-auto gap-4 order-2 sm:order-1 sm:flex-1 justify-between">
                <button 
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="brutal-btn px-4 sm:px-6 py-2.5 sm:py-3 text-sm disabled:opacity-50 flex-1 sm:flex-none flex justify-center"
                >
                  上一頁
                </button>
                <button 
                  disabled={(page + 1) * pageSize >= totalCount}
                  onClick={() => setPage(p => p + 1)}
                  className="brutal-btn px-4 sm:px-6 py-2.5 sm:py-3 text-sm disabled:opacity-50 flex-1 sm:flex-none flex justify-center sm:hidden"
                >
                  下一頁
                </button>
              </div>
              <div className="hidden sm:flex justify-end w-full sm:w-auto gap-4 order-3 sm:order-3 sm:flex-1">
                <button 
                  disabled={(page + 1) * pageSize >= totalCount}
                  onClick={() => setPage(p => p + 1)}
                  className="brutal-btn px-4 sm:px-6 py-2.5 sm:py-3 text-sm disabled:opacity-50 flex-1 sm:flex-none flex justify-center"
                >
                  下一頁
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deduplicate Modal */}
      {showDeduplicateModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white border-4 border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b-4 border-slate-900 bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500 text-white p-2 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-slate-900">移除重複資料</h2>
              </div>
              <button onClick={() => setShowDeduplicateModal(false)} className="brutal-btn p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 bg-white">
              <p className="text-slate-900 font-bold text-sm leading-relaxed">
                這將會掃描整個資料庫，並刪除所有相同准考證號碼的多餘紀錄，只保留最新的一筆。
              </p>
              <p className="text-amber-700 font-bold text-sm bg-amber-50 p-3 border-2 border-amber-200">
                目前資料庫中偵測到 {globalDuplicateTickets.length} 組重複的准考證號碼。
              </p>
              
              <div className="space-y-2 mt-4">
                <label className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-slate-900 inline-block"></span>
                  請輸入 "REMOVE" 以確認執行：
                </label>
                <input 
                  type="text" 
                  value={deduplicateInput}
                  onChange={(e) => setDeduplicateInput(e.target.value)}
                  placeholder="REMOVE"
                  className="w-full p-2.5 sm:p-3 bg-white border-4 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] font-mono text-center text-base sm:text-lg tracking-[0.2em] text-amber-600 font-black focus:outline-none focus:ring-0 focus:border-amber-600 transition-colors placeholder:text-slate-300"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-100 flex justify-end gap-4 border-t-4 border-slate-900">
              <button 
                onClick={() => setShowDeduplicateModal(false)}
                className="brutal-btn px-6 py-2.5"
              >
                取消
              </button>
              <button 
                onClick={executeDeduplicate}
                disabled={deduplicateInput !== 'REMOVE'}
                className="px-6 py-2.5 bg-amber-500 text-slate-900 border-2 border-slate-900 font-black shadow-[4px_4px_0_0_rgba(15,23,42,1)] disabled:opacity-50 disabled:cursor-not-allowed hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
              >
                確認移除
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Deduplicate Success Modal */}
      {deduplicateSuccessMessage && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white border-4 border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] w-full max-w-md overflow-hidden flex flex-col border-t-8 border-t-emerald-500">
            <div className="flex justify-between items-center p-6 border-b-4 border-slate-900 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500 text-white p-2 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                  <Database className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-slate-900">整理完成</h2>
              </div>
              <button onClick={() => setDeduplicateSuccessMessage(null)} className="brutal-btn p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 bg-white">
              <p className="text-slate-900 font-bold text-lg leading-relaxed text-center">
                {deduplicateSuccessMessage}
              </p>
            </div>
            <div className="p-6 bg-slate-100 flex justify-center border-t-4 border-slate-900">
              <button 
                onClick={() => setDeduplicateSuccessMessage(null)}
                className="px-8 py-2.5 bg-slate-900 text-white border-2 border-slate-900 font-black shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-red-50 border-4 border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300">
            {/* Warning Tape Decoration */}
            <div className="absolute top-0 left-0 w-full h-3 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#fcd34d_10px,#fcd34d_20px)] border-b-4 border-slate-900 z-10"></div>
            
            <div className="flex justify-between items-start p-4 pt-6 border-b-4 border-slate-900 bg-white relative z-0">
              <div className="flex flex-row items-center gap-3">
                <div className="bg-red-500 text-white w-10 h-10 flex items-center justify-center border-4 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] rotate-[-6deg]">
                  <AlertTriangle className="w-5 h-5" strokeWidth={3} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">清空資料庫</h2>
                  <p className="text-slate-500 font-bold text-[10px] tracking-wider mt-0.5">DANGER ZONE</p>
                </div>
              </div>
              <button onClick={() => setShowBulkDeleteModal(false)} className="bg-white border-2 border-slate-900 p-1.5 hover:bg-slate-100 transition-colors shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-y-[1px] hover:translate-x-[1px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px]">
                <X className="w-5 h-5 text-slate-900" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 bg-red-50 overflow-y-auto">
              <div className="bg-white border-2 border-slate-900 p-3 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <p className="text-slate-800 font-bold text-xs sm:text-sm leading-relaxed text-justify">
                  警告：您即將清空資料庫中所有的榜單資料。這將會刪除所有學校、科系與錄取名單紀錄。此操作 <strong className="text-red-600 font-black bg-red-100 px-1 py-0.5 ml-1 border border-red-200">無法復原</strong>。
                </p>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-slate-900 inline-block"></span>
                  請輸入 "DELETE" 以確認執行：
                </label>
                <input 
                  type="text" 
                  value={bulkDeleteInput}
                  onChange={(e) => setBulkDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  className="w-full p-2.5 sm:p-3 bg-white border-4 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)] font-mono text-center text-base sm:text-lg tracking-[0.2em] text-red-600 font-black focus:outline-none focus:ring-0 focus:border-red-600 transition-colors placeholder:text-slate-300"
                />
              </div>
            </div>
            
            <div className="p-4 bg-slate-900 flex flex-col sm:flex-row justify-end gap-3">
              <button 
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 sm:py-2.5 bg-white text-slate-900 border-2 border-slate-900 font-black shadow-[4px_4px_0_0_rgba(255,255,255,0.2)] hover:bg-slate-100 transition-all w-full sm:w-auto text-center"
              >
                取消操作
              </button>
              <button 
                onClick={handleBulkDelete}
                disabled={bulkDeleteInput !== 'DELETE'}
                className="px-4 py-2 sm:py-2.5 bg-red-500 text-white border-2 border-slate-900 font-black disabled:opacity-50 disabled:cursor-not-allowed shadow-[4px_4px_0_0_rgba(220,38,38,0.5)] hover:bg-red-400 hover:shadow-[2px_2px_0_0_rgba(220,38,38,0.5)] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex justify-center items-center gap-2 w-full sm:w-auto text-sm sm:text-base tracking-wider"
              >
                確認清空資料庫
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {editingRecord && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white border-4 border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] w-full max-w-2xl overflow-hidden flex flex-col my-8">
            <div className="flex justify-between items-center p-6 border-b-4 border-slate-900 bg-blue-50">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 text-white p-2 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                  <Edit2 className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-black text-slate-900">編輯紀錄</h2>
              </div>
              <button onClick={handleCloseEdit} className="brutal-btn p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-900">年度</label>
                <input 
                  type="text" 
                  value={editForm.year || ''}
                  onChange={(e) => setEditForm({...editForm, year: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-bold text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-900">考區</label>
                <input 
                  type="text" 
                  value={editForm.region || ''}
                  onChange={(e) => setEditForm({...editForm, region: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-bold text-slate-900"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-black text-slate-900">學校名稱</label>
                <input 
                  type="text" 
                  value={editForm.school_name || ''}
                  onChange={(e) => setEditForm({...editForm, school_name: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-bold text-slate-900"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-black text-slate-900">科系/組別</label>
                <input 
                  type="text" 
                  value={editForm.department || ''}
                  onChange={(e) => setEditForm({...editForm, department: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-bold text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-900">准考證號</label>
                <input 
                  type="text" 
                  value={editForm.ticket_number || ''}
                  onChange={(e) => setEditForm({...editForm, ticket_number: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-mono font-bold text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-900">姓名</label>
                <input 
                  type="text" 
                  value={editForm.student_name || ''}
                  onChange={(e) => setEditForm({...editForm, student_name: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-bold text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-900">性別</label>
                <select 
                  value={editForm.gender || ''}
                  onChange={(e) => setEditForm({...editForm, gender: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-bold text-slate-900 cursor-pointer"
                >
                  <option value="">未指定</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>
            </div>
            
            <div className="p-6 bg-slate-100 flex justify-end gap-4 border-t-4 border-slate-900">
              <button 
                onClick={handleCloseEdit}
                className="brutal-btn px-6 py-2.5"
                disabled={isSavingEdit}
              >
                取消
              </button>
              <button 
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-6 py-2.5 bg-blue-600 text-white border-2 border-slate-900 font-black disabled:opacity-50 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-2"
              >
                {isSavingEdit ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                儲存變更
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Batch Delete Modal */}
      {showBatchDeleteModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white border-4 border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] max-w-sm w-full">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 border-2 border-slate-900 flex items-center justify-center mb-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">確定要批次刪除？</h3>
              <p className="text-sm font-bold text-slate-600 mb-6">
                即將刪除所選取的 {selectedIds.size} 筆資料，此動作無法復原。
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowBatchDeleteModal(false)}
                  className="px-4 py-2 bg-white text-slate-700 font-black text-sm border-2 border-slate-900 hover:bg-slate-50 transition-all shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)]"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="px-4 py-2 bg-red-500 text-white font-black text-sm border-2 border-slate-900 hover:bg-red-600 transition-all shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] flex items-center"
                >
                  確定刪除
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Single Delete Modal */}
      {showDeleteConfirmId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white border-4 border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] max-w-sm w-full">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 border-2 border-slate-900 flex items-center justify-center mb-4 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">確定要刪除這筆資料嗎？</h3>
              <p className="text-sm font-bold text-slate-600 mb-6">
                此動作無法復原。
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirmId(null)}
                  className="px-4 py-2 bg-white text-slate-700 font-black text-sm border-2 border-slate-900 hover:bg-slate-50 transition-all shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)]"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    handleDelete(showDeleteConfirmId);
                    setShowDeleteConfirmId(null);
                  }}
                  className="px-4 py-2 bg-red-500 text-white font-black text-sm border-2 border-slate-900 hover:bg-red-600 transition-all shadow-[2px_2px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_0_rgba(15,23,42,1)] flex items-center"
                >
                  確定刪除
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Batch Edit Modal */}
      {showBatchEditModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white border-4 border-slate-900 shadow-[12px_12px_0_0_rgba(15,23,42,1)] w-full max-w-2xl overflow-hidden flex flex-col my-8">
            <div className="flex justify-between items-center p-6 border-b-4 border-slate-900 bg-blue-50">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 text-white p-2 border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                  <Edit2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">批次修改資料</h2>
                  <p className="text-xs font-bold text-slate-600">正在修改 {selectedIds.size} 筆紀錄（空白表示不修改）</p>
                </div>
              </div>
              <button onClick={() => setShowBatchEditModal(false)} className="brutal-btn p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white">
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-900">年度</label>
                <input 
                  type="text" 
                  placeholder="不修改"
                  value={batchEditForm.year || ''}
                  onChange={(e) => setBatchEditForm({...batchEditForm, year: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-bold text-slate-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-900">考區</label>
                <input 
                  type="text" 
                  placeholder="不修改"
                  value={batchEditForm.region || ''}
                  onChange={(e) => setBatchEditForm({...batchEditForm, region: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-bold text-slate-900"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-black text-slate-900">學校名稱</label>
                <input 
                  type="text" 
                  placeholder="不修改"
                  value={batchEditForm.school_name || ''}
                  onChange={(e) => setBatchEditForm({...batchEditForm, school_name: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-bold text-slate-900"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-black text-slate-900">科系/組別</label>
                <input 
                  type="text" 
                  placeholder="不修改"
                  value={batchEditForm.department || ''}
                  onChange={(e) => setBatchEditForm({...batchEditForm, department: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-bold text-slate-900"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-black text-slate-900">性別</label>
                <select 
                  value={batchEditForm.gender || ''}
                  onChange={(e) => setBatchEditForm({...batchEditForm, gender: e.target.value})}
                  className="w-full p-3 brutal-input bg-slate-50 font-bold text-slate-900 cursor-pointer"
                >
                  <option value="">不修改</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>
            </div>
            
            <div className="p-6 bg-slate-100 flex justify-end gap-4 border-t-4 border-slate-900">
              <button 
                onClick={() => setShowBatchEditModal(false)}
                className="brutal-btn px-6 py-2.5"
                disabled={isBatchSaving}
              >
                取消
              </button>
              <button 
                onClick={handleBatchEditSave}
                disabled={isBatchSaving}
                className="px-6 py-2.5 bg-blue-600 text-white border-2 border-slate-900 font-black disabled:opacity-50 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-2"
              >
                {isBatchSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                套用修改
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDownloadCsvModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b-4 border-slate-900 bg-blue-50 flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 border-2 border-slate-900 flex items-center justify-center shrink-0 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">
                <Download className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 mb-1">下載收錄 CSV</h3>
                <p className="text-sm font-bold text-slate-600 leading-relaxed">請選擇您要下載的資料類型。</p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <button
                onClick={() => executeDownloadCSV('noList')}
                disabled={isDownloadingCsv}
                className="w-full px-4 py-3 bg-white border-2 border-slate-900 text-slate-900 font-black hover:bg-slate-50 transition-all flex flex-col items-start gap-1 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>尚未收錄榜單學校清單</span>
                </div>
                <span className="text-xs text-slate-500 font-bold ml-6">下載全國尚未有任何錄取資料的學校列表</span>
              </button>

              <button
                onClick={() => executeDownloadCSV('hasList')}
                disabled={isDownloadingCsv}
                className="w-full px-4 py-3 bg-white border-2 border-slate-900 text-slate-900 font-black hover:bg-slate-50 transition-all flex flex-col items-start gap-1 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>已收錄榜單詳細資料</span>
                </div>
                <span className="text-xs text-slate-500 font-bold ml-6">下載已有錄取資料的學校科系明細與人數</span>
              </button>

              <button
                onClick={() => executeDownloadCSV('combined')}
                disabled={isDownloadingCsv}
                className="w-full px-4 py-3 bg-white border-2 border-slate-900 text-slate-900 font-black hover:bg-slate-50 transition-all flex flex-col items-start gap-1 shadow-[4px_4px_0_0_rgba(15,23,42,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-green-600" />
                  <span>全國高中職收錄統整清單</span>
                </div>
                <span className="text-xs text-slate-500 font-bold ml-6">包含全國所有學校及其收錄狀態</span>
              </button>
            </div>
            
            <div className="p-6 bg-slate-100 flex justify-end gap-4 border-t-4 border-slate-900">
              <button 
                onClick={() => setShowDownloadCsvModal(false)}
                className="brutal-btn px-6 py-2.5"
                disabled={isDownloadingCsv}
              >
                關閉
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {showRestoreModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b-4 border-slate-900 bg-indigo-100">
              <div className="flex items-center gap-2">
                <Upload className="w-6 h-6 text-indigo-900" />
                <h3 className="text-xl font-black text-slate-900 tracking-tight">還原資料庫</h3>
              </div>
              <button 
                onClick={() => setShowRestoreModal(false)}
                className="p-1 hover:bg-slate-900 hover:text-white transition-colors border-2 border-transparent hover:border-slate-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border-2 border-red-900 text-red-900 p-3 font-bold text-sm text-center shadow-[2px_2px_0_0_rgba(127,29,29,1)]">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-black text-slate-900">選擇備份檔案 (.json)</label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                    className="w-full text-sm font-bold text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:border-2 file:border-slate-900 file:bg-slate-100 file:text-slate-900 hover:file:bg-slate-200 file:cursor-pointer cursor-pointer border-2 border-slate-900 p-1"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="block text-sm font-black text-slate-900">還原模式</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRestoreMode('overwrite')}
                      className={`p-3 border-2 border-slate-900 flex flex-col items-center gap-2 transition-all ${restoreMode === 'overwrite' ? 'bg-indigo-100 shadow-[2px_2px_0_0_rgba(15,23,42,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-slate-50 hover:bg-slate-100'}`}
                    >
                      <span className="font-black text-slate-900">覆寫模式</span>
                      <span className="text-[10px] font-bold text-slate-600 text-center">清空目前所有資料<br/>完整匯入備份檔</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestoreMode('merge')}
                      className={`p-3 border-2 border-slate-900 flex flex-col items-center gap-2 transition-all ${restoreMode === 'merge' ? 'bg-indigo-100 shadow-[2px_2px_0_0_rgba(15,23,42,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-slate-50 hover:bg-slate-100'}`}
                    >
                      <span className="font-black text-slate-900">合併模式</span>
                      <span className="text-[10px] font-bold text-slate-600 text-center">保留目前資料<br/>將備份檔資料新增進去</span>
                    </button>
                  </div>
                </div>
                
                {isRestoring && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span>還原進度</span>
                      <span>{restoreProgress}%</span>
                    </div>
                    <div className="w-full h-3 border-2 border-slate-900 bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-300" 
                        style={{ width: `${restoreProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  disabled={isRestoring}
                  className="flex-1 py-3 text-sm font-black text-slate-900 border-2 border-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleRestoreDatabase}
                  disabled={isRestoring || !restoreFile}
                  className="flex-1 py-3 text-sm font-black text-white border-2 border-slate-900 bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isRestoring ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      還原中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      開始還原
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}


      {showCloudBackupModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b-4 border-slate-900 bg-blue-100">
              <div className="flex items-center gap-2">
                <Cloud className="w-6 h-6 text-blue-900" />
                <h3 className="text-xl font-black text-slate-900 tracking-tight">雲端備份管理</h3>
              </div>
              <button 
                onClick={() => setShowCloudBackupModal(false)}
                className="p-1 hover:bg-slate-900 hover:text-white transition-colors border-2 border-transparent hover:border-slate-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border-2 border-blue-900 p-4">
                <h4 className="font-black text-blue-900 mb-2">關於雲端備份</h4>
                <p className="text-sm font-bold text-blue-800">
                  系統會將目前的資料庫完整備份到雲端，並保留最近 3 筆備份紀錄。
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900">雲端備份紀錄</h4>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 border-2 border-slate-900">
                    {cloudBackups.length} / 3 筆
                  </span>
                </div>
                
                {cloudBackups.length === 0 ? (
                  <div className="text-center py-8 text-sm font-bold text-slate-500 border-2 border-dashed border-slate-300">
                    尚無備份紀錄
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {cloudBackups.map((backup, index) => (
                      <div key={backup.id} className="p-3 border-2 border-slate-900 bg-slate-50 flex items-center justify-between group hover:bg-slate-100 transition-colors">
                        <div>
                          <div className="font-black text-slate-900 text-sm">{backup.file_name}</div>
                          <div className="text-xs font-bold text-slate-500">
                            {new Date(backup.created_at).toLocaleString('zh-TW')}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestoreFromCloud(backup.id)}
                          disabled={isRestoringFromCloud || isSyncingBackup}
                          className="px-3 py-1.5 bg-white border-2 border-slate-900 text-xs font-black text-slate-900 hover:bg-indigo-50 hover:text-indigo-700 transition-colors shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50"
                        >
                          還原
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSyncBackup}
                  disabled={isSyncingBackup || isRestoringFromCloud}
                  className="w-full py-3 text-sm font-black text-white border-2 border-slate-900 bg-blue-600 hover:bg-blue-700 transition-colors shadow-[4px_4px_0_0_rgba(15,23,42,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isSyncingBackup ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      同步備份中...
                    </>
                  ) : (
                    <>
                      <Cloud className="w-4 h-4" />
                      建立新的雲端備份
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ChangePasswordModal 
        isOpen={showChangePasswordModal} 
        onClose={() => setShowChangePasswordModal(false)} 
      />
    </div>
  );
}
