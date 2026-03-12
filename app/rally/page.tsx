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
      console.error("데이터 로드 중 오류:", err);
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
  console.log("🚀 클라이언트: 체크인 프로세스 시작");
  const point = searchParams.get('point')?.toUpperCase() as 'START' | 'MID' | 'FINISH' | null;

  // 체크인 조건 확인
  if (!point) {
    console.log("⚠️ 클라이언트: point 파라미터가 없습니다.");
    return;
  }
  if (isProcessing) {
    console.log("⏳ 클라이언트: 이미 처리 중입니다.");
    return;
  }
  if (!user?.id) {
    console.log("👤 클라이언트: 유저 로그인 정보가 없습니다.");
    return;
  }

  console.log("✅ 클라이언트: 모든 조건 충족. 서버 액션 호출 직전!", { point, userId: user.id });

  try {
    setIsProcessing(true);

    // [중요] 서버 액션 호출
    const result = await handleCheckIn(point, user.id, user.name || '참가자');

    // 이제 result를 로그로 찍어야 에러가 안 납니다.
    console.log("📡 서버로부터 응답 받음:", result);

    if (result.success) {
      // 성공 시: URL 파라미터 제거 및 상태 새로고침
      window.history.replaceState({}, '', '/rally');
      await fetchStatus(user.id);
      alert(result.message);
    } else {
      // 실패 시: 에러 원인 알림
      alert(`⚠️ 인증 실패: ${result.message}`);
      window.history.replaceState({}, '', '/rally');
    }
  } catch (err: any) {
    // 예상치 못한 네트워크/런타임 에러 발생 시
    console.error("🔥 클라이언트 처리 중 심각한 오류:", err);
    alert(`시스템 오류가 발생했습니다: ${err.message}`);
  } finally {
    setIsProcessing(false);
  }
};

    fetchStatus(parsedUser.id);
    processCheckIn();

    const interval = setInterval(() => fetchStatus(parsedUser.id), 5000);
    return () => clearInterval(interval);
  }, [searchParams]);

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

            <div
              className="absolute top-[16px] left-10 h-1 bg-red-500 z-0 transition-all duration-700 ease-in-out"
              style={{
                width: currentStep === 'FINISH' ? 'calc(100% - 80px)' : currentStep === 'MID' ? '50%' : '0%'
              }}
            ></div>

            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="bg-white p-1 rounded-full">
                {['START', 'MID', 'FINISH'].includes(currentStep || '')
                  ? <CheckCircle2 className="text-red-500" size={32} fill="white" />
                  : <Circle className="text-zinc-200" size={32} />}
              </div>
              <span className={`text-[11px] font-black uppercase ${currentStep ? 'text-red-600' : 'text-zinc-300'}`}>Start</span>
            </div>

            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className="bg-white p-1 rounded-full">
                {['MID', 'FINISH'].includes(currentStep || '')
                  ? <CheckCircle2 className="text-red-500" size={32} fill="white" />
                  : <Circle className="text-zinc-200" size={32} />}
              </div>
              <span className={`text-[11px] font-black uppercase ${['MID', 'FINISH'].includes(currentStep || '') ? 'text-red-600' : 'text-zinc-300'}`}>Mid</span>
            </div>

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
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">동기화 중...</div>}>
      <DashboardContent />
    </Suspense>
  );
}