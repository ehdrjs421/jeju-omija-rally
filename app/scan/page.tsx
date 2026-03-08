'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { handleCheckIn } from '@/app/actions/checkin';

export default function ScanPage() {
  const router = useRouter();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<'scanning' | 'processing' | 'success' | 'error'>('scanning');
  const [message, setMessage] = useState('카메라 권한을 확인 중입니다...');

  useEffect(() => {
    // 1. 카메라 시작 (후면 카메라 고정)
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        qrScannerRef.current = html5QrCode;

        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0 
        };

        await html5QrCode.start(
          { facingMode: "environment" }, 
          config,
          onScanSuccess,
          () => {} 
        );
        setMessage('지점의 QR 코드를 사각형 안에 맞춰주세요.');
      } catch (err) {
        setStatus('error');
        setMessage('카메라를 사용할 수 없습니다. 권한 설정을 확인해주세요.');
      }
    };

    // 2. 스캔 성공 시 통합 처리 로직
    const onScanSuccess = async (decodedText: string) => {
      if (qrScannerRef.current?.isScanning) {
        await qrScannerRef.current.stop();
      }

      setStatus('processing');
      setMessage('인증 정보를 확인하고 있습니다...');

      try {
        // [유연한 추출] URL 파라미터나 텍스트에서 point 값을 찾음 (대소문자 무관)
        const pointMatch = decodedText.match(/[?&]point=(START|MID|FINISH)/i);
        let point = pointMatch ? (pointMatch[1].toUpperCase() as 'START' | 'MID' | 'FINISH') : null;

        // 주소가 아닌 단어만 들어왔을 경우 대비
        if (!point && ['START', 'MID', 'FINISH'].includes(decodedText.trim().toUpperCase())) {
          point = decodedText.trim().toUpperCase() as 'START' | 'MID' | 'FINISH';
        }

        if (!point) {
          throw new Error('유효하지 않은 랠리 QR 코드입니다.');
        }

        // [순서 제어] 서버 액션 호출
        const result = await handleCheckIn(point);

        if (!result.success) {
          setStatus('error');
          setMessage(result.message);
          return;
        }

        // [GPS 및 DB 저장]
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              const savedUser = localStorage.getItem('omija_user');
              const user = JSON.parse(savedUser || '{}');

              const { error: dbError } = await supabase.from('stamps').insert({
                user_id: user.id,
                checkpoint_id: point,
                gps_lat: latitude,
                gps_lng: longitude,
              });

              if (dbError) {
                setStatus('error');
                setMessage('데이터 저장 중 오류가 발생했습니다.');
              } else {
                setStatus('success');
                setMessage(`${point} 지점 인증 성공! 잠시 후 이동합니다.`);
                setTimeout(() => router.push('/rally'), 2000);
              }
            },
            () => {
              setStatus('error');
              setMessage('GPS 권한이 필요합니다. 위치 정보를 허용해주세요.');
            }
          );
        }
      } catch (err) {
        setStatus('error');
        setMessage('잘못된 QR 주소입니다. (내용: ' + decodedText.substring(0, 15) + '...)');
      }
    };

    startScanner();

    return () => {
      if (qrScannerRef.current?.isScanning) {
        qrScannerRef.current.stop().catch(console.error);
      }
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      <div className="p-4 flex items-center gap-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">지점 인증하기</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <style jsx global>{`
          #reader { border: none !important; border-radius: 24px !important; overflow: hidden !important; }
          #reader__dashboard { display: none !important; }
          #reader__camera_selection { display: none !important; }
          video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
        `}</style>

        <div className="w-full max-w-sm aspect-square relative z-10 overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900">
          <div id="reader" className="w-full h-full"></div>
          {status === 'scanning' && (
            <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none flex items-center justify-center z-20">
              <div className="w-full h-0.5 bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse"></div>
            </div>
          )}
        </div>

        <div className="mt-10 text-center px-10 h-32">
          {status === 'processing' && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>}
          <p className={`text-lg font-medium leading-relaxed ${status === 'error' ? 'text-red-400' : 'text-zinc-300'}`}>
            {message}
          </p>
          {status === 'error' && (
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-zinc-800 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              다시 시도하기
            </button>
          )}
        </div>
      </div>

      <div className="p-8 bg-zinc-900 text-center text-xs text-zinc-500 border-t border-zinc-800">
        <p className="flex items-center justify-center gap-2">
          <MapPin size={14} /> GPS 위치 기반 인증 활성화
        </p>
      </div>
    </main>
  );
}