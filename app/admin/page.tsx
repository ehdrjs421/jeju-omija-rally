'use client';
export const dynamic = 'force-dynamic'; // 추가

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Trophy, AlertTriangle, RefreshCw, Search, Edit3, LogOut } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. 관리자 인증 함수
  const handleAuth = () => {
    // 실제 운영 시 비밀번호를 환경변수나 더 안전한 방법으로 관리하세요.
    if (password === 'omija2026') { 
      setIsAdmin(true);
      fetchAdminData();
    } else {
      alert('비밀번호가 틀렸습니다.');
    }
  };

  // 2. 전체 참가자 데이터 불러오기 (통합 조회)
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
      alert("데이터를 가져오는데 실패했습니다.");
    } else if (data) {
      const formatted = data.map((u: any) => ({
        ...u,
        lapCount: u.laps[0]?.count || 0,
        lastStamp: u.stamps.sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
      }));
      // 완주 횟수 내림차순 정렬
      setStats(formatted.sort((a, b) => b.lapCount - a.lapCount));
    }
    setLoading(false);
  };

  // 3. 🚀 핵심: 수동 위치 갱신 및 DB 반영 함수
  const manualStamp = async (userId: string, userName: string) => {
  const checkpoint = prompt(`${userName}님의 인증 지점을 선택하세요:\n(START, MID, FINISH)`);
  if (!checkpoint) return;
  
  const upperPoint = checkpoint.trim().toUpperCase();
  if (!['START', 'MID', 'FINISH'].includes(upperPoint)) {
    return alert('START, MID, FINISH 중 하나를 입력해주세요.');
  }

  try {
    // 1. stamps 기록 추가
    const { error: stampError } = await supabase.from('stamps').insert({
      user_id: userId,
      checkpoint_id: upperPoint,
      gps_lat: 0,
      gps_lng: 0,
      admin_override: true
    });

    if (stampError) throw new Error(`스탬프 저장 실패: ${stampError.message}`);

    // 2. FINISH인 경우 laps(완주) 기록 추가
    if (upperPoint === 'FINISH') {
      // 💡 [중요] 현재 몇 바퀴인지 먼저 조회해서 다음 바퀴 번호를 생성합니다.
      const { count: currentLaps } = await supabase
        .from('laps')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const nextLapNum = (currentLaps || 0) + 1;

      const { error: lapError } = await supabase.from('laps').insert({
        user_id: userId,
        lap_number: nextLapNum, // ✅ null 에러 방지를 위해 계산된 값 삽입
      });

      if (lapError) throw new Error(`완주 기록(laps) 저장 실패: ${lapError.message}`);
    }

    alert(`${userName}님의 ${upperPoint} 기록이 반영되었습니다!`);
    fetchAdminData(); // 화면 새로고침
  } catch (err: any) {
    console.error(err);
    alert(`[오류 발생] ${err.message}`);
  }
};

  // 검색 필터링 로직
  const filteredStats = stats.filter(s => 
    s.name.includes(searchTerm) || s.bib_number.includes(searchTerm)
  );

  // --- UI 시작 ---

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-center">
          <div className="mb-6 inline-flex p-4 bg-red-50 rounded-2xl text-red-600">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-black mb-2 text-zinc-900 italic tracking-tight">ADMIN ACCESS</h1>
          <p className="text-zinc-500 text-sm mb-8">관리자 전용 관제 시스템입니다.</p>
          <input 
            type="password" 
            className="w-full p-4 border border-zinc-200 rounded-2xl mb-4 outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all text-center text-lg font-bold"
            placeholder="Passcode"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
          />
          <button 
            onClick={handleAuth} 
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-black text-lg active:scale-95 transition-all shadow-xl shadow-zinc-200"
          >
            ENTER SYSTEM
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-4 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-md">LIVE</span>
               <h1 className="text-3xl font-black text-zinc-900 tracking-tighter">운영국 관제 대시보드</h1>
            </div>
            <p className="text-zinc-500 text-sm font-medium">참가자 데이터 실시간 모니터링 및 수동 제어</p>
          </div>
          <div className="flex gap-2">
            <button 
                onClick={fetchAdminData} 
                className="p-4 bg-white border border-zinc-200 rounded-2xl shadow-sm hover:bg-zinc-100 transition-all flex items-center gap-2 font-bold text-zinc-600"
            >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                데이터 동기화
            </button>
            <button 
                onClick={() => setIsAdmin(false)}
                className="p-4 bg-zinc-200 rounded-2xl text-zinc-600 hover:bg-red-50 hover:text-red-600 transition-all"
            >
                <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* 대시보드 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Users</p>
                <p className="text-3xl font-black text-zinc-900">{stats.length}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-zinc-100 shadow-sm">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Top Laps</p>
                <p className="text-3xl font-black text-red-600">{Math.max(...stats.map(s => s.lapCount), 0)}</p>
            </div>
            <div className="hidden md:block bg-zinc-900 p-6 rounded-[2rem] shadow-xl border border-zinc-800">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1 text-white/50">System Status</p>
                <p className="text-xl font-bold text-green-400 flex items-center gap-2 uppercase italic">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> 
                    Online
                </p>
            </div>
        </div>

        {/* 데이터 테이블 */}
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-zinc-100 overflow-hidden">
          <div className="p-6 border-b bg-zinc-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="font-black text-zinc-800 italic">PARTICIPANT LIST</h3>
            <div className="relative w-full md:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                    className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-200 transition-all" 
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
                  <th className="p-6">완주 기록</th>
                  <th className="p-6">현재 위치</th>
                  <th className="p-6 text-right">기록 제어</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 text-zinc-700">
                {filteredStats.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="p-6">
                      <p className="font-black text-zinc-900">{row.name}</p>
                      <p className="text-xs text-zinc-400 font-medium tracking-tight">BIB: {row.bib_number}</p>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-black text-red-600">{row.lapCount}</span>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase">Laps</span>
                      </div>
                    </td>
                    <td className="p-6">
                      {row.lastStamp ? (
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-zinc-800">{row.lastStamp.checkpoint_id}</span>
                          <span className="text-[10px] font-medium text-zinc-400">{new Date(row.lastStamp.created_at).toLocaleTimeString()}</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300 font-medium">기록 없음</span>
                      )}
                    </td>
                    <td className="p-6 text-right">
                      <button 
                        onClick={() => manualStamp(row.id, row.name)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-zinc-200"
                      >
                        <Edit3 size={14} /> 강제 인증
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStats.length === 0 && (
                <div className="py-20 text-center text-zinc-400">
                    검색 결과와 일치하는 참가자가 없습니다.
                </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}