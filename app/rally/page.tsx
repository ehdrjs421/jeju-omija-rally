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
  const hasProcessed = useRef(false);

  // 현재 유저의 랠리 상태 조회
  const fetchStatus = async (userId: string) => {
    try {
      const { count } = await supabase.from('laps').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      setLapCount(count || 0);

      const { data: lastLap } = await supabase.from('laps').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const lastLapTime = lastLap?.created_at || '1970-01-01T00:00:00Z';

      const { data: stamps } = await supabase
        .from('stamps')
        .select('checkpoint_id')
        .eq('user_id', userId)
        .gt('created_at', lastLapTime)
        .order('created_at', { ascending: false });

      setCurrentStep(stamps?.[0]?.checkpoint_id || null);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const saved = localStorage.getItem('omija_user');
    if (!saved) { router.replace('/'); return; }
    const parsed = JSON.parse(saved);
    setUser(parsed);
    setIsChecking(false);

    const params = new URLSearchParams(window.location.search);
    const pointParam = params.get('point')?.toUpperCase();
    const latStr = params.get('lat');
    const lngStr = params.get('lng');

    const isValidPoint = (p: string | undefined): p is 'START' | 'MID' | 'FINISH' => {
      return ['START', 'MID', 'FINISH'].includes(p || '');
    };

    if (isValidPoint(pointParam) && !hasProcessed.current) {
      hasProcessed.current = true;
      const process = async () => {
        setIsProcessing(true);
        if (!latStr || !lngStr) {
          alert("위치 정보가 누락되었습니다.");
          router.replace('/rally');
          setIsProcessing(false);
          return;
        }

        try {
          const result = await handleCheckIn(pointParam, parsed.id, parsed.name, parseFloat(latStr), parseFloat(lngStr));
          alert(result.message);
        } catch (err) {
          alert("인증 처리 중 오류가 발생했습니다.");
        } finally {
          router.replace('/rally');
          await fetchStatus(parsed.id);
          setIsProcessing(false);
        }
      };
      process();
    } else {
      fetchStatus(parsed.id);
    }
  }, [router]);

  if (isChecking) return <div className="min-h-screen bg-zinc-900 flex items-center justify-center text-white"><Loader2 className="animate-spin text-red-500" size={40} /></div>;

  return (
    <main className="min-h-screen bg-zinc-50 pb-24 font-sans text-zinc-900">
      <div className="bg-[#D32F2F] p-8 text-white rounded-b-[2.5rem] shadow-lg">
        <div className="flex justify-between items-center mb-6 opacity-80 text-sm">
          <span className="font-bold tracking-tighter uppercase">Jeju Fire Festival 2026</span>
          <button onClick={() => { localStorage.removeItem('omija_user'); router.push('/'); }}><LogOut size={20} /></button>
        </div>
        <h1 className="text-3xl font-black italic mb-1">{user?.name}님,</h1>
        <p className="opacity-90">{isProcessing ? "인증 데이터 확인 중..." : "오미자 랠리 완주에 도전하세요!"}</p>
      </div>

      <div className="p-6 space-y-4 -mt-8">
        <div className="bg-white p-8 rounded-[2rem] shadow-md border border-zinc-100">
          <div className="flex items-center justify-between relative px-4">
            <div className="absolute top-[16px] left-10 right-10 h-1 bg-zinc-100 z-0"></div>
            {[
              { id: 'START', label: '출발' },
              { id: 'MID', label: '정상' },
              { id: 'FINISH', label: '도착' }
            ].map((step) => {
              const isCompleted = 
                (step.id === 'START' && ['START', 'MID', 'FINISH'].includes(currentStep || '')) ||
                (step.id === 'MID' && ['MID', 'FINISH'].includes(currentStep || '')) ||
                (step.id === 'FINISH' && currentStep === 'FINISH');

              return (
                <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                  <div className="bg-white p-1 rounded-full">
                    {isCompleted ? <CheckCircle2 className="text-red-500" size={32} /> : <Circle className="text-zinc-200" size={32} />}
                  </div>
                  <span className={`text-[11px] font-black ${isCompleted ? 'text-red-600' : 'text-zinc-300'}`}>{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 text-center">
            <p className="text-[10px] text-zinc-400 font-black mb-1">TOTAL LAPS</p>
            <p className="text-3xl font-black text-zinc-800">{lapCount}</p>
          </div>
          <button onClick={() => router.push('/ranking')} className="bg-zinc-900 p-6 rounded-[2rem] text-yellow-500 flex flex-col items-center group active:scale-95 transition-all">
            <p className="text-[10px] text-zinc-500 font-black mb-1">RANKING</p>
            <Trophy size={28} className="group-hover:scale-110" />
          </button>
        </div>
      </div>

      <div className="fixed bottom-6 left-0 right-0 px-6 z-50">
        <button onClick={() => router.push('/scan')} disabled={isProcessing} className="w-full h-20 bg-zinc-900 text-white rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 border-4 border-white active:scale-95 disabled:opacity-50 transition-all">
          <QrCode size={32} /> {isProcessing ? "인증 중..." : "인증하기"}
        </button>
      </div>
    </main>
  );
}