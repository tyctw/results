import React, { useState } from 'react';
import { Lock } from 'lucide-react';

export default function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    const isStaticPagesDeploy = window.location.hostname.endsWith('github.io') && !apiBaseUrl;

    if (isStaticPagesDeploy) {
      setError('GitHub Pages 靜態網站不支援管理後端，請改用本機或後端部署環境登入。');
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password })
      });
      
      if (response.ok) {
        sessionStorage.setItem('adminPassword', password);
        onLogin();
      } else {
        setError('密碼錯誤或伺服器無回應');
      }
    } catch (err) {
      console.error(err);
      setError('連線失敗');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mt-16 sm:mt-24 brutal-card p-8 sm:p-12 animate-in fade-in duration-500 bg-white">
      <div className="flex flex-col items-center mb-10">
        <div className="bg-slate-900 p-5 mb-6 border-2 border-slate-900 shadow-[4px_4px_0_0_rgba(15,23,42,1)]">
          <Lock className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">管理員登入</h2>
        <p className="text-slate-600 text-sm mt-3 font-bold tracking-wide">請輸入密碼以存取解析器與管理功能</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-8">
        <div>
          <input
            type="password"
            aria-label="管理員密碼"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-4 brutal-input bg-slate-50 text-center text-lg tracking-widest text-slate-900 font-black"
            placeholder="••••••••"
          />
          {error && <p className="text-white bg-slate-900 p-2 mt-3 font-black text-center border-2 border-slate-900 shadow-[2px_2px_0_0_rgba(15,23,42,1)]">{error}</p>}
        </div>
        <button
          type="submit"
          className="w-full brutal-btn-primary py-4 text-lg"
        >
          安全登入
        </button>
      </form>
    </div>
  );
}
