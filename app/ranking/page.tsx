'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, Medal, ChevronLeft, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RankingPage() {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  const fetchRankings = async () => {
    setIsRefreshing(true);
    // 🚀 유저 정보와 완주 횟수를 가져옵니다.
    const { data, error } = await supabase
      .from('users')
      .select(`
        name,
        bib_number,
        laps (count)
      `);

    if (!error && data) {
      const sorted = data
        .map((u: any) => ({
          name: u.name,
          bib: u.bib_number,
          count: u.laps[0]?.count || 0
        }))
        // 1. 바퀴 수 높은 순 -> 2. 바퀴 수 같으면 배번 순(또는 이름 순)
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        // 테스트용: 0회인 사람은 제외하고 싶다면 아래 주석 해제
        // .filter(p => p.count > 0); 
      
      setRankings(sorted);
    }
    setLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchRankings();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 pb-10 font-sans">
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md p-6 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-zinc-600 p-1 hover:bg-zinc-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-zinc-900">실시간 랭킹</h1>
        </div>
        <button 
          onClick={fetchRankings} 
          className={`text-zinc-400 ${isRefreshing ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            <p className="text-zinc-400 text-sm">순위를 집계 중입니다...</p>
          </div>
        ) : rankings.length > 0 ? (
          rankings.map((player, index) => (
            <div 
              key={player.bib}
              className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${
                index === 0 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200 shadow-sm ring-1 ring-yellow-200' : 
                index === 1 ? 'bg-white border-zinc-200' :
                index === 2 ? 'bg-white border-zinc-200' :
                'bg-zinc-100/50 border-transparent text-zinc-600'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* 등수 표시 로직 */}
                <div className="w-8 flex justify-center font-black italic">
                  {index === 0 ? <Trophy className="text-yellow-500" size={26} /> : 
                   index === 1 ? <Medal className="text-zinc-400" size={26} /> : 
                   index === 2 ? <Medal className="text-orange-400" size={26} /> : 
                   <span className="text-lg">{index + 1}</span>}
                </div>
                
                <div>
                  <p className={`font-bold ${index < 3 ? 'text-zinc-900' : 'text-zinc-600'}`}>
                    {player.name}
                  </p>
                  <p className="text-[10px] tracking-widest text-zinc-400">BIB {player.bib}</p>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-black ${index === 0 ? 'text-orange-600' : 'text-zinc-800'}`}>
                    {player.count}
                  </span>
                  <span className="text-xs font-bold text-zinc-400">LAPS</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20">
            <p className="text-zinc-400">아직 완주 기록이 없습니다.<br/>첫 번째 주인공이 되어보세요!</p>
          </div>
        )}
      </div>

      {/* 안내 문구 */}
      <p className="text-center text-zinc-400 text-[11px] mt-6 px-10 leading-relaxed">
        랭킹은 지점 인증이 완료될 때마다 실시간으로 집계됩니다.<br/>
        완주 횟수가 동일할 경우 이름 순으로 표시됩니다.
      </p>
    </main>
  );
}