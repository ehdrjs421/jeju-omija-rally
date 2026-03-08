'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, MapPin, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { handleCheckIn } from '@/app/actions/checkin'; // 아까 만든 서버 액션

export default function ScanPage() {
  const router = useRouter();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<'scanning' | 'processing' | 'success' | 'error'>('scanning');
  const [message, setMessage] = useState('카메라 권한을 확인 중입니다...');

  useEffect(() => {
    // 1. 카메라 시작 함수
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        qrScannerRef.current = html5QrCode;

        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0 
        };

        // 후면 카메라(environment)로 즉시 시작 (권한 팝업 발생)
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config,
          onScanSuccess,
          () => {} // 스캔 시도 중 오류 무시
        );
        setMessage('지점의 QR 코드를 사각형 안에 맞춰주세요.');
      } catch (err) {
        setStatus('error');
        setMessage('카메라를 사용할 수 없습니다. 권한 설정을 확인해주세요.');
      }
    };

    // 2. QR 스캔 성공 시 실행될 로직
    const onScanSuccess = async (decodedText: string) => {
      // 중복 실행 방지를 위해 즉시 카메라 중지
      if (qrScannerRef.current?.isScanning) {
        await qrScannerRef.current.stop();
      }

      setStatus('processing');
      setMessage('인증 정보를 확인하고 있습니다...');

      try {
        // URL에서 point 파라미터 추출 (예: .../rally?point=START)
        const url = new URL(decodedText);
        const point = url.searchParams.get('point') as 'START' | 'MID' | 'FINISH';

        if (!point) {
          throw new Error('유효하지 않은 랠리 QR 코드입니다.');
        }

        // [순서 제어] 서버 액션 호출 (START -> MID -> FINISH 체크)
        const result = await handleCheckIn(point);

        if (!result.success) {
          setStatus('error');
          setMessage(result.message);
          return;
        }

        // [GPS 기록] 순서 검증 통과 시에만 실행
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              
              // 로컬스토리지에서 유저 정보 확인
              const savedUser = localStorage.getItem('omija_user');
              const user = JSON.parse(savedUser || '{}');

              // 'stamps' 테이블에 최종 기록
              const { error: dbError } = await supabase.from('stamps').insert({
                user_id: user.id,
                checkpoint_id: point, // 'START', 'MID' 등 저장
                gps_lat: latitude,
                gps_lng: longitude,
              });

              if (dbError) {
                setStatus('error');
                setMessage('기록 저장 중 오류가 발생했습니다.');
              } else {
                setStatus('success');
                setMessage(`${point} 지점 인증 성공! 잠시 후 이동합니다.`);
                setTimeout(() => router.push('/rally'), 2000);
              }
            },
            (geoError) => {
              setStatus('error');
              setMessage('GPS 권한이 필요합니다. 위치 정보를 허용해주세요.');
            }
          );
        }
      } catch (err) {
        setStatus('error');
        setMessage('잘못된 QR 코드 주소입니다.');
      }
    };

    startScanner();

    // 클린업: 페이지를 나갈 때 카메라 종료
    return () => {
      if (qrScannerRef.current?.isScanning) {
        qrScannerRef.current.stop().catch(console.error);
      }
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* 상단 바 */}
      <div className="p-4 flex items-center gap-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">지점 인증하기</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <style jsx global>{`
          #reader { border: none !important; border-radius: 24px !important; overflow: hidden !important; }
          #reader__dashboard { display: none !important; } /* 기본 UI 숨김 */
          video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
        `}</style>

        <div className="w-full max-w-sm aspect-square relative z-10 overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900 flex items-center justify-center">
          <div id="reader" className="w-full h-full"></div>
          
          {/* 스캐닝 가이드 오버레이 */}
          {status === 'scanning' && (
            <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none flex items-center justify-center z-20">
              <div className="w-full h-0.5 bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse"></div>
            </div>
          )}
        </div>

        {/* 상태 메시지 영역 */}
        <div className="mt-10 text-center px-10 h-24">
          {status === 'processing' && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>}
          <p className={`text-lg font-medium leading-relaxed ${status === 'error' ? 'text-red-400' : 'text-zinc-300'}`}>
            {message}
          </p>
          {status === 'error' && (
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 text-sm text-zinc-500 underline"
            >
              다시 시도하기
            </button>
          )}
        </div>
      </div>

      <div className="p-8 bg-zinc-900 text-center text-xs text-zinc-500 border-t border-zinc-800">
        <p className="flex items-center justify-center gap-2">
          <MapPin size={14} /> 보안을 위해 GPS 위치 기반 인증을 사용합니다.
        </p>
      </div>
    </main>
  );
}