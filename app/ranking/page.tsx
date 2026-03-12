'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, Medal, ChevronLeft, RefreshCw, Loader2, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RankingPage() {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  const fetchRankings = async () => {
    setIsRefreshing(true);
    
    // 🚀 유저 정보와 각 유저의 모든 laps 기록을 가져옵니다.
    // created_at을 가져와서 '누가 더 빨리 돌았는지' 판단합니다.
    const { data, error } = await supabase
      .from('users')
      .select(`
        name,
        bib_number,
        laps (created_at)
      `);

    if (!error && data) {
      const sorted = data
        .map((u: any) => {
          const lapTimes = u.laps || [];
          // 이 유저의 마지막 완주 시간을 구합니다. (가장 늦게 찍힌 기록)
          const lastLapTime = lapTimes.length > 0 
            ? Math.max(...lapTimes.map((l: any) => new Date(l.created_at).getTime()))
            : Infinity; // 완주 기록이 없으면 무한대(꼴찌)

          return {
            name: u.name,
            bib: u.bib_number,
            count: lapTimes.length,
            lastLapTime: lastLapTime
          };
        })
        // 🔥 정렬 로직:
        // 1. 완주 횟수가 많은 순서대로 (b.count - a.count)
        // 2. 완주 횟수가 같다면, 마지막 완주 시간이 빠른 순서대로 (a.lastLapTime - b.lastLapTime)
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          return a.lastLapTime - b.lastLapTime;
        });
      
      setRankings(sorted);
    } else if (error) {
      console.error("랭킹 로드 오류:", error);
    }
    
    setLoading(false);
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchRankings();
    const timer = setInterval(fetchRankings, 20000); // 20초마다 자동 갱신
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 pb-10 font-sans text-zinc-900">
      {/* 상단 바 */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md p-6 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-zinc-600 p-1 hover:bg-zinc-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-black tracking-tight">실시간 랭킹</h1>
        </div>
        <button 
          onClick={fetchRankings} 
          disabled={isRefreshing}
          className={`text-zinc-400 p-2 hover:bg-zinc-100 rounded-full transition-all ${isRefreshing ? 'animate-spin' : ''}`}
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="animate-spin text-red-600" size={40} />
            <p className="text-zinc-400 text-sm font-medium">기록 측정 중...</p>
          </div>
        ) : rankings.length > 0 ? (
          rankings.map((player, index) => {
            const isTop3 = index < 3;
            return (
              <div 
                key={player.bib}
                className={`flex items-center justify-between p-5 rounded-[2.2rem] border transition-all duration-300 ${
                  index === 0 ? 'bg-gradient-to-br from-yellow-50 via-white to-orange-50 border-yellow-200 shadow-lg scale-[1.02] z-10' : 
                  index === 1 ? 'bg-white border-zinc-200 shadow-sm' :
                  index === 2 ? 'bg-white border-zinc-200 shadow-sm' :
                  'bg-white/60 border-zinc-100 text-zinc-500'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 flex justify-center font-black italic">
                    {index === 0 ? <Trophy className="text-yellow-500 drop-shadow-sm" size={32} /> : 
                     index === 1 ? <Medal className="text-zinc-400" size={30} /> : 
                     index === 2 ? <Medal className="text-orange-400" size={30} /> : 
                     <span className="text-lg font-black opacity-20">{index + 1}</span>}
                  </div>
                  
                  <div>
                    <p className={`font-black text-lg leading-tight ${isTop3 ? 'text-zinc-900' : 'text-zinc-600'}`}>
                      {player.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-2 py-0.5 bg-zinc-100 rounded-full font-bold text-zinc-400 uppercase">
                        BIB {player.bib}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-black tracking-tighter ${index === 0 ? 'text-orange-600' : 'text-zinc-800'}`}>
                      {player.count}
                    </span>
                    <span className="text-[10px] font-black text-zinc-400 uppercase">Laps</span>
                  </div>
                  {/* 동점자 변별력을 위한 최근 완주 시각 표시 (선택 사항) */}
                  {player.count > 0 && (
                    <div className="flex items-center gap-1 mt-1 opacity-40">
                      <Clock size={10} />
                      <span className="text-[9px] font-medium">
                        {new Date(player.lastLapTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-32 bg-white rounded-[3rem] border border-zinc-200 border-dashed">
            <p className="text-zinc-400">데이터가 없습니다.</p>
          </div>
        )}
      </div>

      <footer className="px-10 py-8">
        <div className="bg-zinc-900/5 rounded-3xl p-5 border border-zinc-200/50">
          <p className="text-center text-zinc-500 text-[11px] leading-relaxed font-semibold">
            ⏱️ 랭킹 동점 기준 안내<br/>
            완주 횟수가 같을 경우, 마지막 지점을 먼저 통과(인증)한<br/>
            참가자가 더 높은 순위로 표시됩니다.
          </p>
        </div>
      </footer>
    </main>
  );
}