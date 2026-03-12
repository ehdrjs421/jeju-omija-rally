'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, QrCode, LogOut, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { handleCheckIn } from '@/app/actions/checkin';

export default function RallyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [lapCount, setLapCount] = useState(0);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. 상태 및 스탬프 정보 불러오기 함수
  const fetchStatus = async (userId: string) => {
    try {
      const { count } = await supabase
        .from('laps')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      setLapCount(count || 0);

      const { data: latestStamps } = await supabase
        .from('stamps')
        .select('checkpoint_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestStamps && latestStamps.length > 0) {
        setCurrentStep(latestStamps[0].checkpoint_id.toUpperCase().trim());
      } else {
        setCurrentStep(null);
      }
    } catch (err) {
      console.error("데이터 로드 오류:", err);
    }
  };

  useEffect(() => {
    // 🚀 [STEP 1] 유저 정보 확인
    const savedUser = localStorage.getItem('omija_user');
    if (!savedUser) {
      router.replace('/');
      return;
    }
    const parsedUser = JSON.parse(savedUser);
    setUser(parsedUser);

    // 🚀 [STEP 2] URL 파라미터 수동 추출 (Suspense 이슈 방지)
    const params = new URLSearchParams(window.location.search);
    const point = params.get('point')?.toUpperCase() as 'START' | 'MID' | 'FINISH' | null;

    const processCheckIn = async (currentUser: any) => {
      if (!point) return;
      if (isProcessing) return;

      console.log("🔥 [체크인 시작] 발견된 포인트:", point);
      setIsProcessing(true);

      try {
        const result = await handleCheckIn(point, currentUser.id, currentUser.name || '참가자');
        console.log("📡 서버 응답 수신:", result);

        if (result.success) {
          alert(result.message);
        } else {
          alert(`⚠️ 실패: ${result.message}`);
        }
        
        // URL 파라미터 제거 및 데이터 새로고침
        window.history.replaceState({}, '', '/rally');
        await fetchStatus(currentUser.id);
      } catch (err: any) {
        console.error("🔥 서버 액션 호출 중 심각한 오류:", err);
        alert("서버 통신 중 오류가 발생했습니다.");
      } finally {
        setIsProcessing(false);
      }
    };

    // 로드 즉시 실행
    fetchStatus(parsedUser.id);
    if (point) processCheckIn(parsedUser);

    // 5초 주기 업데이트
    const interval = setInterval(() => fetchStatus(parsedUser.id), 5000);
    return () => clearInterval(interval);
  }, []); // 의존성을 비워 렌더링 무한 루프 방지

  // 유저 정보 로드 전 대기 화면
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center text-white font-sans">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin mx-auto text-red-500" size={40} />
          <p className="font-black tracking-widest text-sm uppercase">Loading Profile...</p>
        </div>
      </div>
    );
  }

  const getStatusMessage = () => {
    if (isProcessing) return "인증 정보를 처리 중입니다...";
    if (currentStep === 'FINISH') return "방금 완주했습니다! 새로운 바퀴를 시작하세요.";
    if (currentStep === 'MID') return "정상을 통과했습니다! 하산 지점으로 이동하세요.";
    if (currentStep === 'START') return "출발했습니다! 정상을 향해 달리세요!";
    return "준비되셨나요? 출발 지점에서 QR을 스캔해주세요!";
  };

  return (
    <main className="min-h-screen bg-zinc-50 pb-24 font-sans text-zinc-900">
      {/* 상단 헤더 */}
      <div className="bg-[#D32F2F] p-8 text-white rounded-b-[2.5rem] shadow-lg">
        <div className="flex justify-between items-center mb-6 text-sm opacity-80 font-medium">
          <span>2026 제주들불축제</span>
          <button onClick={() => { localStorage.removeItem('omija_user'); router.push('/'); }}>
            <LogOut size={20} />
          </button>
        </div>
        <h1 className="text-3xl font-black mb-1 italic">{user.name}님,</h1>
        <div className="text-lg opacity-90 leading-tight flex items-center gap-2">
          {isProcessing && <Loader2 size={18} className="animate-spin" />}
          <p>{getStatusMessage()}</p>
        </div>
      </div>

      <div className="p-6 space-y-4 -mt-8">
        {/* 진행 상황 프로그레스 바 */}
        <div className="bg-white p-8 rounded-[2rem] shadow-md border border-zinc-100">
          <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-8 text-center">Current Progress</h2>
          <div className="flex items-center justify-between relative px-4">
            <div className="absolute top-[16px] left-10 right-10 h-1 bg-zinc-100 z-0"></div>
            <div
              className="absolute top-[16px] left-10 h-1 bg-red-500 z-0 transition-all duration-700 ease-in-out"
              style={{
                width: currentStep === 'FINISH' ? 'calc(100% - 80px)' : currentStep === 'MID' ? '50%' : '0%'
              }}
            ></div>

            {[
              { id: 'START', label: 'Start' },
              { id: 'MID', label: 'Mid' },
              { id: 'FINISH', label: 'Finish' }
            ].map((step) => {
              const isCompleted = 
                (step.id === 'START' && ['START', 'MID', 'FINISH'].includes(currentStep || '')) ||
                (step.id === 'MID' && ['MID', 'FINISH'].includes(currentStep || '')) ||
                (step.id === 'FINISH' && currentStep === 'FINISH');

              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
                  <div className="bg-white p-1 rounded-full">
                    {isCompleted ? (
                      <CheckCircle2 className="text-red-500" size={32} fill="white" />
                    ) : (
                      <Circle className="text-zinc-200" size={32} />
                    )}
                  </div>
                  <span className={`text-[11px] font-black uppercase ${isCompleted ? 'text-red-600' : 'text-zinc-300'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 랩 카운트 & 랭킹 버튼 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 text-center">
            <p className="text-[10px] text-zinc-400 font-black mb-1 uppercase tracking-widest">Total Laps</p>
            <p className="text-3xl font-black text-zinc-800">{lapCount}</p>
          </div>
          <button onClick={() => router.push('/ranking')} className="bg-zinc-900 p-6 rounded-[2rem] shadow-xl text-center active:scale-95 transition-all group">
            <p className="text-[10px] text-zinc-500 font-black mb-1 uppercase tracking-widest">Ranking</p>
            <div className="flex justify-center text-yellow-500 group-hover:scale-110 transition-transform"><Trophy size={28} /></div>
          </button>
        </div>
      </div>

      {/* 하단 고정 스캔 버튼 */}
      <div className="fixed bottom-6 left-0 right-0 px-6">
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