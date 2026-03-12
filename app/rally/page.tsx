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
  const [isChecking, setIsChecking] = useState(true);
  const [lapCount, setLapCount] = useState(0);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchStatus = async (userId: string) => {
    const { count } = await supabase.from('laps').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    setLapCount(count || 0);
    const { data } = await supabase.from('stamps').select('checkpoint_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
    setCurrentStep(data?.[0]?.checkpoint_id || null);
  };

  useEffect(() => {
    const saved = localStorage.getItem('omija_user');
    if (!saved) { router.replace('/'); return; }
    const parsed = JSON.parse(saved);
    setUser(parsed);
    setIsChecking(false);

    const params = new URLSearchParams(window.location.search);
    const point = params.get('point')?.toUpperCase() as any;

    if (point) {
      const process = async () => {
        setIsProcessing(true);
        const result = await handleCheckIn(
          point, 
          parsed.id, 
          parsed.name, 
          parseFloat(params.get('lat') || '0'), 
          parseFloat(params.get('lng') || '0')
        );
        alert(result.message);
        window.history.replaceState({}, '', '/rally');
        await fetchStatus(parsed.id);
        setIsProcessing(false);
      };
      process();
    }

    fetchStatus(parsed.id);
    const timer = setInterval(() => fetchStatus(parsed.id), 5000);
    return () => clearInterval(timer);
  }, []);

  if (isChecking) return <div className="min-h-screen bg-zinc-900 flex items-center justify-center text-white"><Loader2 className="animate-spin text-red-500" /></div>;

  return (
    <main className="min-h-screen bg-zinc-50 pb-24 font-sans text-zinc-900">
      <div className="bg-[#D32F2F] p-8 text-white rounded-b-[2.5rem] shadow-lg">
        <div className="flex justify-between items-center mb-6 opacity-80 text-sm">
          <span>2026 제주들불축제</span>
          <button onClick={() => { localStorage.removeItem('omija_user'); router.push('/'); }}><LogOut size={20} /></button>
        </div>
        <h1 className="text-3xl font-black italic">{user.name}님,</h1>
        <p className="text-lg opacity-90">{isProcessing ? "인증 처리 중..." : "새별오름 랠리 진행 중!"}</p>
      </div>

      <div className="p-6 space-y-4 -mt-8">
        <div className="bg-white p-8 rounded-[2rem] shadow-md border border-zinc-100">
          <div className="flex items-center justify-between relative px-4">
            <div className="absolute top-[16px] left-10 right-10 h-1 bg-zinc-100 -z-0"></div>
            {['START', 'MID', 'FINISH'].map((step) => (
              <div key={step} className="relative z-10 flex flex-col items-center gap-2">
                {currentStep === step || (step==='START' && currentStep) ? <CheckCircle2 className="text-red-500" size={32} /> : <Circle className="text-zinc-200" size={32} />}
                <span className="text-[10px] font-black uppercase">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm text-center">
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest">Laps</p>
            <p className="text-3xl font-black">{lapCount}</p>
          </div>
          <button onClick={() => router.push('/ranking')} className="bg-zinc-900 p-6 rounded-[2rem] text-yellow-500 flex flex-col items-center">
            <p className="text-[10px] text-zinc-500 font-black uppercase mb-1">Ranking</p>
            <Trophy size={28} />
          </button>
        </div>
      </div>

      <div className="fixed bottom-6 left-0 right-0 px-6">
        <button onClick={() => router.push('/scan')} className="w-full h-20 bg-zinc-900 text-white rounded-[2rem] font-black text-xl shadow-2xl flex items-center justify-center gap-3 border-4 border-white">
          <QrCode size={32} /> SCAN QR
        </button>
      </div>
    </main>
  );
}