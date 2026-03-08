'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [name, setName] = useState('');
  const [bib, setBib] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!name || !bib) return alert('이름과 배번을 입력해주세요.');
    setLoading(true);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('name', name.trim())
      .eq('bib_number', bib.trim())
      .maybeSingle();

    if (error) {
      setLoading(false);
      return alert('시스템 오류가 발생했습니다.');
    }

    if (!data) {
      setLoading(false);
      return alert('등록되지 않은 참가자 정보입니다. 본부석에 문의해주세요!');
    }

    localStorage.setItem('omija_user', JSON.stringify(data));
    router.push('/rally');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
        <h1 className="text-2xl font-bold text-center text-red-600 mb-6">오미자 랠리 본인확인</h1>
        <div className="space-y-4">
          <input 
            className="w-full p-4 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-black"
            placeholder="이름" value={name} onChange={(e) => setName(e.target.value)}
          />
          <input 
            className="w-full p-4 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-black"
            placeholder="배번 (예: A101)" value={bib} onChange={(e) => setBib(e.target.value)}
          />
          <button 
            onClick={handleLogin} disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-white transition-all ${loading ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'}`}
          >
            {loading ? '명단 확인 중...' : '확인 완료'}
          </button>
        </div>
      </div>
    </main>
  );
}