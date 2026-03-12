'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, QrCode, LogOut, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { handleCheckIn } from '@/app/actions/checkin';

export default function RallyPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [lapCount, setLapCount] = useState(0);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const hasProcessed = useRef(false); // 중복 실행 방지용

  const fetchStatus = async (userId: string) => {
    try {
      const { count } = await supabase.from('laps').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      setLapCount(count || 0);
      const { data } = await supabase.from('stamps').select('checkpoint_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
      setCurrentStep(data?.[0]?.checkpoint_id || null);
    } catch (e) {
      console.error("데이터 갱신 오류:", e);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('omija_user');
    if (!saved) { router.replace('/'); return; }
    const parsed = JSON.parse(saved);
    setUser(parsed);
    setIsChecking(false);

    // 🚀 URL 파라미터 추출
    const params = new URLSearchParams(window.location.search);
    const point = params.get('point')?.toUpperCase() as any;
    const latStr = params.get('lat');
    const lngStr = params.get('lng');

    // 🚀 인증 로직 실행
    if (point && !hasProcessed.current) {
      hasProcessed.current = true; // 실행됨을 표시

      const process = async () => {
        setIsProcessing(true);

        // 좌표값이 없는 경우 처리
        if (!latStr || !lngStr) {
          alert("위치 정보가 누락되었습니다. 다시 스캔해주세요.");
          router.replace('/rally');
          setIsProcessing(false);
          return;
        }

        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);

        try {
          const result = await handleCheckIn(point, parsed.id, parsed.name, lat, lng);
          
          if (result.success) {
            alert(result.message);
          } else {
            alert(`⚠️ 인증 실패: ${result.message}`);
          }
        } catch (err) {
          alert("서버 통신 중 오류가 발생했습니다.");
        } finally {
          // 주소창에서 파라미터 제거 (뒤로가기 시 중복 방지)
          window.history.replaceState({}, '', '/rally');
          await fetchStatus(parsed.id);
          setIsProcessing(false);
        }
      };
      process();
    }

    fetchStatus(parsed.id);
    const timer = setInterval(() => fetchStatus(parsed.id), 5000);
    return () => clearInterval(timer);
  }, [router]);

  if (isChecking) return (
    <div className="min-h-screen bg-zinc-900 flex flex-col items-center justify-center text-white">
      <Loader2 className="animate-spin text-red-500 mb-2" size={40} />
      <p className="text-sm font-bold tracking-widest">준비 중...</p>
    </div>
  );

  return (
    <main className="min-h-screen bg-zinc-50 pb-24 font-sans text-zinc-900">
      {/* 상단 헤더 */}
      <div className="bg-[#D32F2F] p-8 text-white rounded-b-[2.5rem] shadow-lg">
        <div className="flex justify-between items-center mb-6 opacity-80 text-sm">
          <span>2026 제주들불축제</span>
          <button onClick={() => { localStorage.removeItem('omija_user'); router.push('/'); }}><LogOut size={20} /></button>
        </div>
        <h1 className="text-3xl font-black italic">{user.name}님,</h1>
        <div className="flex items-center gap-2 text-lg opacity-90 leading-tight">
          {isProcessing && <Loader2 size={18} className="animate-spin" />}
          <p>{isProcessing ? "인증을 처리하고 있습니다..." : "새별오름 랠리에 오신 걸 환영합니다!"}</p>
        </div>
      </div>

      <div className="p-6 space-y-4 -mt-8">
        {/* 진행 상황 프로그레스 */}
        <div className="bg-white p-8 rounded-[2rem] shadow-md border border-zinc-100">
          <div className="flex items-center justify-between relative px-4">
            <div className="absolute top-[16px] left-10 right-10 h-1 bg-zinc-100 z-0"></div>
            {['START', 'MID', 'FINISH'].map((step) => {
              const isCompleted = 
                (step === 'START' && ['START', 'MID', 'FINISH'].includes(currentStep || '')) ||
                (step === 'MID' && ['MID', 'FINISH'].includes(currentStep || '')) ||
                (step === 'FINISH' && currentStep === 'FINISH');

              return (
                <div key={step} className="relative z-10 flex flex-col items-center gap-2">
                  <div className="bg-white p-1 rounded-full">
                    {isCompleted ? <CheckCircle2 className="text-red-500" size={32} /> : <Circle className="text-zinc-200" size={32} />}
                  </div>
                  <span className={`text-[10px] font-black uppercase ${isCompleted ? 'text-red-600' : 'text-zinc-300'}`}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 하단 기록 섹션 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 text-center">
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mb-1">Total Laps</p>
            <p className="text-3xl font-black text-zinc-800">{lapCount}</p>
          </div>
          <button onClick={() => router.push('/ranking')} className="bg-zinc-900 p-6 rounded-[2rem] shadow-xl text-yellow-500 flex flex-col items-center group">
            <p className="text-[10px] text-zinc-500 font-black uppercase mb-1 tracking-widest">Ranking</p>
            <Trophy size={28} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* 하단 고정 스캔 버튼 */}
      <div className="fixed bottom-6 left-0 right-0 px-6">
        <button 
          onClick={() => router.push('/scan')} 
          disabled={isProcessing}
          className="w-full h-20 bg-zinc-900 text-white rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 border-4 border-white active:scale-95 disabled:opacity-50 transition-all"
        >
          <QrCode size={32} /> {isProcessing ? "PROCESSING..." : "SCAN QR"}
        </button>
      </div>
    </main>
  );
}