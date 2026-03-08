'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Trophy, QrCode, LogOut, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { handleCheckIn } from '@/app/actions/checkin';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [lapCount, setLapCount] = useState(0);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 상태를 가져오는 공통 함수
  const fetchStatus = async (userId: string) => {
    // 1. 전체 완주 횟수 (laps 테이블)
    const { count } = await supabase
      .from('laps')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    setLapCount(count || 0);

    // 2. 가장 최근에 찍힌 스탬프 확인 (stamps 테이블)
    const { data: latestStamps } = await supabase
      .from('stamps')
      .select('checkpoint_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (latestStamps && latestStamps.length > 0) {
      setCurrentStep(latestStamps[0].checkpoint_id.toUpperCase().trim());
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('omija_user');
    if (!savedUser) {
      router.replace('/');
      return;
    }
    const parsedUser = JSON.parse(savedUser);
    setUser(parsedUser);

    const processCheckIn = async () => {
  const point = searchParams.get('point')?.toUpperCase() as 'START' | 'MID' | 'FINISH' | null;
  
  if (point && !isProcessing && parsedUser.id) {
    setIsProcessing(true);

    try {
      const result = await handleCheckIn(point, parsedUser.id);
      
      if (result.success) {
        // 1. 현재 지점 스탬프 찍기
        const { error: dbError } = await supabase.from('stamps').insert({
          user_id: parsedUser.id,
          checkpoint_id: point,
        });

        if (!dbError) {
          // 2. 만약 FINISH 지점이라면 laps 테이블에 완주 기록 추가
          if (result.isFinish) {
            const { error: lapError } = await supabase.from('laps').insert({
              user_id: parsedUser.id,
              // 필요하다면 여기서 어떤 코스인지 코스 ID 등을 추가할 수 있습니다.
            });
            
            if (!lapError) {
              console.log("완주 기록 저장 완료!");
            }
          }

          // 주소창 파라미터 제거 및 상태 갱신
          window.history.replaceState({}, '', '/rally');
          await fetchStatus(parsedUser.id);
          
          if (result.isFinish) {
            alert("🎊 축하합니다! 완주하셨습니다! 🎊");
          } else {
            alert(`${point} 지점 인증 성공!`);
          }
        }
      } else {
        alert(result.message);
        window.history.replaceState({}, '', '/rally');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  }
};

    fetchStatus(parsedUser.id);
    processCheckIn();
    
    // 실시간 업데이트 (5초 주기)
    const interval = setInterval(() => fetchStatus(parsedUser.id), 5000);
    return () => clearInterval(interval);
  }, [searchParams]); // URL 파라미터가 바뀔 때마다 재실행

  if (!user) return null;

  const getStatusMessage = () => {
    if (isProcessing) return "인증 정보를 처리 중입니다...";
    if (currentStep === 'FINISH') return "방금 완주했습니다! 새로운 바퀴를 시작하세요.";
    if (currentStep === 'MID') return "정상을 통과했습니다! 하산 지점으로 이동하세요.";
    if (currentStep === 'START') return "출발했습니다! 정상을 향해 달리세요!";
    return "준비되셨나요? 출발 지점에서 QR을 스캔해주세요!";
  };

  return (
    <main className="min-h-screen bg-zinc-50 pb-24 font-sans text-zinc-900">
      <div className="bg-[#D32F2F] p-8 text-white rounded-b-[2.5rem] shadow-lg">
        <div className="flex justify-between items-center mb-6 text-sm opacity-80 font-medium">
          <span>2026 제주들불축제</span>
          <button onClick={() => { localStorage.removeItem('omija_user'); router.push('/'); }}>
            <LogOut size={20} />
          </button>
        </div>
        <h1 className="text-3xl font-black mb-1 italic">{user.name}님,</h1>
        <p className="text-lg opacity-90 leading-tight flex items-center gap-2">
          {isProcessing && <Loader2 size={18} className="animate-spin" />}
          {getStatusMessage()}
        </p>
      </div>

      <div className="p-6 space-y-4 -mt-8">
        <div className="bg-white p-8 rounded-[2rem] shadow-md border border-zinc-100">
          <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-8 text-center">Current Progress</h2>
          <div className="flex items-center justify-between relative px-4">
            <div className="absolute top-[16px] left-10 right-10 h-1 bg-zinc-100 z-0"></div>
            
            {/* 게이지 바 */}
            <div 
              className="absolute top-[16px] left-10 h-1 bg-red-500 z-0 transition-all duration-700 ease-in-out"
              style={{ 
                width: currentStep === 'FINISH' ? 'calc(100% - 80px)' : currentStep === 'MID' ? '50%' : currentStep === 'START' ? '0%' : '0%' 
              }}
            ></div>

            {/* 지점 1: START */}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="bg-white p-1 rounded-full">
                {['START', 'MID', 'FINISH'].includes(currentStep || '')
                  ? <CheckCircle2 className="text-red-500" size={32} fill="white" /> 
                  : <Circle className="text-zinc-200" size={32} />}
              </div>
              <span className={`text-[11px] font-black uppercase ${currentStep ? 'text-red-600' : 'text-zinc-300'}`}>Start</span>
            </div>

            {/* 지점 2: MID */}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="bg-white p-1 rounded-full">
                {['MID', 'FINISH'].includes(currentStep || '')
                  ? <CheckCircle2 className="text-red-500" size={32} fill="white" /> 
                  : <Circle className="text-zinc-200" size={32} />}
              </div>
              <span className={`text-[11px] font-black uppercase ${['MID', 'FINISH'].includes(currentStep || '') ? 'text-red-600' : 'text-zinc-300'}`}>Mid</span>
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

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white font-sans">오미자 랠리 불러오는 중...</div>}>
      <DashboardContent />
    </Suspense>
  );
}