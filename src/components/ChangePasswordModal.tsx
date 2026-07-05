import React, { useState } from 'react';
import { X, Key, Save, Loader2, Check } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('新密碼不能小於 6 個字元');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    try {
      const adminPassword = sessionStorage.getItem('adminPassword');
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword || ''
        },
        body: JSON.stringify({ newPassword })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || '變更密碼失敗');
      }
      
      setSuccess(true);
      sessionStorage.setItem('adminPassword', newPassword);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setNewPassword('');
        setConfirmPassword('');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '發生未知錯誤');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-slate-900 shadow-[8px_8px_0_0_rgba(15,23,42,1)] w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b-4 border-slate-900 bg-amber-400">
          <div className="flex items-center gap-2">
            <Key className="w-6 h-6 text-slate-900" />
            <h3 className="text-xl font-black text-slate-900 tracking-tight">變更管理員密碼</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-900 hover:text-white transition-colors border-2 border-transparent hover:border-slate-900"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {success ? (
            <div className="flex flex-col items-center justify-center p-8 gap-4 text-emerald-600">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center border-4 border-emerald-600">
                <Check className="w-8 h-8" />
              </div>
              <p className="text-lg font-black tracking-tight">密碼變更成功！</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border-2 border-red-900 text-red-900 p-3 font-bold text-sm text-center shadow-[2px_2px_0_0_rgba(127,29,29,1)]">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-black text-slate-900">新密碼</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-3 border-2 border-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-400 font-bold tracking-widest text-center"
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-black text-slate-900">確認新密碼</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3 border-2 border-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-400 font-bold tracking-widest text-center"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 py-3 text-sm font-black text-slate-900 border-2 border-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 text-sm font-black text-slate-900 border-2 border-slate-900 bg-amber-400 hover:bg-amber-300 transition-colors shadow-[2px_2px_0_0_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      儲存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      儲存密碼
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
