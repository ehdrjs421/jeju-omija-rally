'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, MapPin, QrCode, LogOut, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [lapCount, setLapCount] = useState(0);
  // 현재 위치 상태 (가장 최근에 찍은 지점 저장)
  const [currentStep, setCurrentStep] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('omija_user');
    if (!savedUser) {
      router.replace('/');
      return;
    }
    const parsedUser = JSON.parse(savedUser);
    setUser(parsedUser);

    const fetchStatus = async () => {
      // 1. 전체 완주 횟수 가져오기
      const { count } = await supabase
        .from('laps')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', parsedUser.id);
      setLapCount(count || 0);

      // 2. 🚀 [핵심 수정] 가장 마지막에 찍힌 스탬프 1개만 가져오기
      const { data: latestStamps, error } = await supabase
        .from('stamps')
        .select('checkpoint_id')
        .eq('user_id', parsedUser.id)
        .order('created_at', { ascending: false }) // 최신순 정렬
        .limit(1); // 1개만

      if (latestStamps && latestStamps.length > 0) {
        const lastPoint = latestStamps[0].checkpoint_id.toUpperCase().trim();
        setCurrentStep(lastPoint);
      }
    };

    fetchStatus();
    
    // 실시간성 보장을 위해 5초마다 갱신하거나, 필요 시 이 로직 유지
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [router]);

  if (!user) return null;

  // 진행 상태에 따른 메시지 결정
  const getStatusMessage = () => {
    if (currentStep === 'FINISH') return "방금 완주했습니다! 새로운 바퀴를 시작하세요.";
    if (currentStep === 'MID') return "정상을 통과했습니다! 하산 지점으로 이동하세요.";
    if (currentStep === 'START') return "출발했습니다! 정상을 향해 달리세요!";
    return "준비되셨나요? 출발 지점에서 QR을 스캔해주세요!";
  };

  return (
    <main className="min-h-screen bg-zinc-50 pb-24 font-sans">
      <div className="bg-[#D32F2F] p-8 text-white rounded-b-[2.5rem] shadow-lg">
        <div className="flex justify-between items-center mb-6 text-sm opacity-80 font-medium">
          <span>2026 제주들불축제</span>
          <button onClick={() => { localStorage.removeItem('omija_user'); router.push('/'); }}>
            <LogOut size={20} />
          </button>
        </div>
        <h1 className="text-3xl font-black mb-1 italic">{user.name}님,</h1>
        <p className="text-lg opacity-90 leading-tight">{getStatusMessage()}</p>
      </div>

      <div className="p-6 space-y-4 -mt-8">
        {/* 실시간 진행 상황 스태퍼 */}
        <div className="bg-white p-8 rounded-[2rem] shadow-md border border-zinc-100">
          <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-8 text-center">Current Progress</h2>
          <div className="flex items-center justify-between relative px-4">
            {/* 배경 연결 선 */}
            <div className="absolute top-[16px] left-10 right-10 h-1 bg-zinc-100 z-0"></div>
            
            {/* 활성화된 연결 선 (상태에 따른 게이지) */}
            <div 
              className="absolute top-[16px] left-10 h-1 bg-red-500 z-0 transition-all duration-700 ease-in-out"
              style={{ 
                width: currentStep === 'FINISH' ? 'calc(100% - 80px)' : currentStep === 'MID' ? '50%' : '0%' 
              }}
            ></div>

            {/* 지점 1: START */}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="bg-white p-1 rounded-full">
                {(currentStep === 'START' || currentStep === 'MID' || currentStep === 'FINISH')
                  ? <CheckCircle2 className="text-red-500" size={32} fill="white" /> 
                  : <Circle className="text-zinc-200" size={32} />}
              </div>
              <span className={`text-[11px] font-black uppercase ${currentStep ? 'text-red-600' : 'text-zinc-300'}`}>Start</span>
            </div>

            {/* 지점 2: MID */}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="bg-white p-1 rounded-full">
                {(currentStep === 'MID' || currentStep === 'FINISH')
                  ? <CheckCircle2 className="text-red-500" size={32} fill="white" /> 
                  : <Circle className="text-zinc-200" size={32} />}
              </div>
              <span className={`text-[11px] font-black uppercase ${ (currentStep === 'MID' || currentStep === 'FINISH') ? 'text-red-600' : 'text-zinc-300'}`}>Mid</span>
            </div>

            {/* 지점 3: FINISH */}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="bg-white p-1 rounded-full">
                {currentStep === 'FINISH'
                  ? <CheckCircle2 className="text-red-500" size={32} fill="white" /> 
                  : <Circle className="text-zinc-200" size={32} />}
              </div>
              <span className={`text-[11px] font-black uppercase ${currentStep === 'FINISH' ? 'text-red-600' : 'text-zinc-300'}`}>Finish</span>
            </div>
          </div>
        </div>

        {/* 완주 횟수 & 랭킹 버튼 (기존 동일) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 text-center">
            <p className="text-[10px] text-zinc-400 font-black mb-1 uppercase tracking-widest">Total Laps</p>
            <p className="text-3xl font-black text-zinc-800">{lapCount}</p>
          </div>
          <button onClick={() => router.push('/ranking')} className="bg-zinc-900 p-6 rounded-[2rem] shadow-xl text-center active:scale-95 transition-all">
            <p className="text-[10px] text-zinc-500 font-black mb-1 uppercase tracking-widest">Ranking</p>
            <div className="flex justify-center text-yellow-500"><Trophy size={28} /></div>
          </button>
        </div>
      </div>

      <div className="fixed bottom-6 left-0 right-0 px-6 font-sans">
        <button 
          onClick={() => router.push('/scan')}
          className="w-full h-20 bg-zinc-900 text-white rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all border-4 border-white"
        >
          <QrCode size={32} /> SCAN QR
        </button>
      </div>
    </main>
  );
}