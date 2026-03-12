'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Trophy, AlertTriangle, RefreshCw, Search, Edit3, LogOut, CheckCircle2 } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 지점 코드와 한글 명칭 매핑
  const POINT_LABELS: Record<string, string> = {
    START: '출발',
    MID: '정상',
    FINISH: '도착'
  };

  const handleAuth = () => {
    if (password === 'omija2026') { 
      setIsAdmin(true);
      fetchAdminData();
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, name, bib_number,
        laps (count),
        stamps (checkpoint_id, created_at)
      `);

    if (error) {
      console.error("데이터 로드 에러:", error);
    } else if (data) {
      const formatted = data.map((u: any) => ({
        ...u,
        lapCount: u.laps[0]?.count || 0,
        lastStamp: u.stamps.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
      }));
      setStats(formatted.sort((a, b) => b.lapCount - a.lapCount));
    }
    setLoading(false);
  };

  // 🚀 수동 인증 로직: 순차 가이드 및 한글화 반영
  const manualStamp = async (userId: string, userName: string) => {
    if (loading) return;

    try {
      setLoading(true);

      // 1. 현재 사용자의 마지막 완주 이후 스탬프 목록 가져오기
      const { data: lastLap } = await supabase
        .from('laps')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastLapTime = lastLap?.created_at || '1970-01-01T00:00:00Z';

      const { data: currentStamps } = await supabase
        .from('stamps')
        .select('checkpoint_id')
        .eq('user_id', userId)
        .gt('created_at', lastLapTime)
        .order('created_at', { ascending: true });

      const stampedPoints = currentStamps?.map(s => s.checkpoint_id.toUpperCase()) || [];
      
      // 2. 다음에 찍어야 할 지점 자동 판별 (START -> MID -> FINISH)
      let nextStep: 'START' | 'MID' | 'FINISH' = "START";
      if (stampedPoints.includes("MID")) {
        nextStep = "FINISH";
      } else if (stampedPoints.includes("START")) {
        nextStep = "MID";
      }

      // 3. 한글 명칭으로 확인 창 띄우기
      const nextLabel = POINT_LABELS[nextStep];
      const confirmMsg = `[${userName}]님의 다음 인증 순서는 <${nextLabel}>입니다.\n강제 인증을 진행하시겠습니까?`;
      
      if (!confirm(confirmMsg)) {
        setLoading(false);
        return;
      }

      // 4. 스탬프 기록 추가
      const { error: stampError } = await supabase.from('stamps').insert({
        user_id: userId,
        checkpoint_id: nextStep, // DB에는 START, MID, FINISH로 저장 (일관성 유지)
        gps_lat: 0,
        gps_lng: 0,
        admin_override: true
      });

      if (stampError) throw new Error(`스탬프 저장 실패: ${stampError.message}`);

      // 5. FINISH인 경우 완주(laps) 처리 및 중복 방지
      if (nextStep === 'FINISH') {
        const { count } = await supabase
          .from('laps')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);

        const nextLapNum = (count || 0) + 1;

        const { error: lapError } = await supabase.from('laps').insert({
          user_id: userId,
          lap_number: nextLapNum,
        });

        if (lapError) {
          if (lapError.code === '23505') throw new Error("이미 완주 처리가 된 바퀴입니다.");
          throw new Error(`완주 기록 저장 실패: ${lapError.message}`);
        }
      }

      alert(`${userName}님 [${nextLabel}] 인증이 완료되었습니다!`);
      await fetchAdminData(); // 대시보드 새로고침
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredStats = stats.filter(s => s.name.includes(searchTerm) || s.bib_number.includes(searchTerm));

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6 text-zinc-900">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-center">
          <div className="mb-6 inline-flex p-4 bg-red-50 rounded-2xl text-red-600"><AlertTriangle size={32} /></div>
          <h1 className="text-2xl font-black mb-2 italic tracking-tight uppercase text-zinc-900">Admin Access</h1>
          <input 
            type="password" 
            className="w-full p-4 border border-zinc-200 rounded-2xl mb-4 outline-none focus:border-red-500 text-center text-lg font-bold"
            placeholder="Passcode"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
          />
          <button onClick={handleAuth} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black active:scale-95 transition-all">ENTER SYSTEM</button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-4 md:p-10 font-sans text-zinc-900">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-md">LIVE</span>
               <h1 className="text-3xl font-black tracking-tighter text-zinc-900">운영국 관제 대시보드</h1>
            </div>
            <p className="text-zinc-500 text-sm font-medium">참가자 데이터 수동 제어 모드</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchAdminData} className="p-4 bg-white border border-zinc-200 rounded-2xl flex items-center gap-2 font-bold text-zinc-600 hover:bg-zinc-50 transition-all shadow-sm">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> 동기화
            </button>
            <button onClick={() => setIsAdmin(false)} className="p-4 bg-zinc-200 rounded-2xl text-zinc-600 hover:text-red-600 transition-all"><LogOut size={18} /></button>
          </div>
        </header>

        <div className="bg-white rounded-[2.5rem] shadow-sm border border-zinc-100 overflow-hidden">
          <div className="p-6 border-b bg-zinc-50/50 flex justify-between items-center">
            <h3 className="font-black italic text-zinc-800">PARTICIPANT LIST</h3>
            <div className="relative w-72 text-zinc-900">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                    className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-200" 
                    placeholder="배번 또는 이름 검색..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 text-zinc-400 text-[10px] uppercase font-black tracking-widest border-b border-zinc-100">
                  <th className="p-6">참가자 정보</th>
                  <th className="p-6 text-center">완주 기록</th>
                  <th className="p-6 text-center">현재 위치</th>
                  <th className="p-6 text-right">기록 제어</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filteredStats.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-6">
                      <p className="font-black text-zinc-900">{row.name}</p>
                      <p className="text-xs text-zinc-400 font-medium tracking-tight">BIB: {row.bib_number}</p>
                    </td>
                    <td className="p-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl font-black text-red-600">{row.lapCount}</span>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Laps</span>
                      </div>
                    </td>
                    <td className="p-6 text-center">
                      {row.lastStamp ? (
                        <div className="flex flex-col items-center">
                          <span className="px-3 py-1 bg-zinc-900 text-white text-[11px] font-black rounded-full mb-1">
                            {POINT_LABELS[row.lastStamp.checkpoint_id] || row.lastStamp.checkpoint_id}
                          </span>
                          <span className="text-[10px] font-medium text-zinc-400 italic">
                            {new Date(row.lastStamp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ) : <span className="text-zinc-300 font-medium">인증 전</span>}
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => manualStamp(row.id, row.name)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-xs font-black rounded-xl hover:bg-red-600 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-zinc-200"
                      >
                        <Edit3 size={14} /> {loading ? "처리중..." : "다음 단계 인증"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}