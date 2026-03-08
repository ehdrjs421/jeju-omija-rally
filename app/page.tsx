'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { handleCheckIn } from '@/app/actions/checkin';

export default function ScanPage() {
  const router = useRouter();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<'scanning' | 'processing' | 'success' | 'error'>('scanning');
  const [message, setMessage] = useState('카메라 권한을 확인 중입니다...');

  useEffect(() => {
    // 1. 카메라 시작 함수 (후면 카메라 고정)
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        qrScannerRef.current = html5QrCode;

        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0 
        };

        // facingMode: "environment"로 후면 카메라 강제 호출
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config,
          onScanSuccess,
          () => {} // 스캔 시도 중 에러는 무시
        );
        setMessage('지점의 QR 코드를 사각형 안에 맞춰주세요.');
      } catch (err) {
        setStatus('error');
        setMessage('카메라를 사용할 수 없습니다. 권한 설정을 확인해주세요.');
      }
    };

    // 2. 스캔 성공 시 처리 로직
    const onScanSuccess = async (decodedText: string) => {
      // 중복 실행 방지를 위해 즉시 카메라 중지
      if (qrScannerRef.current?.isScanning) {
        await qrScannerRef.current.stop();
      }

      setStatus('processing');
      setMessage('인증 정보를 확인하고 있습니다...');

      try {
        // [단축 URL 대응] 텍스트 내에 키워드가 포함되어 있는지 확인
        const upperText = decodedText.toUpperCase();
        let point: 'START' | 'MID' | 'FINISH' | null = null;

        if (upperText.includes('START')) point = 'START';
        else if (upperText.includes('MID')) point = 'MID';
        else if (upperText.includes('FINISH')) point = 'FINISH';

        if (!point) {
          throw new Error('랠리용 QR 코드가 아닙니다.');
        }

        // [순서 제어] 서버 액션 호출 (직전 지점 확인)
        const result = await handleCheckIn(point);

        if (!result.success) {
          setStatus('error');
          setMessage(result.message); // "START를 먼저 찍으세요" 등 출력
          return;
        }

        // [데이터 저장] 순서 검증 통과 시 stamps 테이블에 기록
        const savedUser = localStorage.getItem('omija_user');
        const user = JSON.parse(savedUser || '{}');

        // GPS 데이터는 기록용으로만 수집 (제한 로직은 제거됨)
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;

            const { error: dbError } = await supabase.from('stamps').insert({
              user_id: user.id,
              checkpoint_id: point,
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
          async () => {
            // GPS 권한 거부 시에도 일단 체크인은 진행 (기록만 0으로)
            await supabase.from('stamps').insert({
              user_id: user.id,
              checkpoint_id: point,
            });
            setStatus('success');
            setMessage(`${point} 지점 인증 성공! (위치 정보 제외)`);
            setTimeout(() => router.push('/rally'), 2000);
          }
        );

      } catch (err) {
        setStatus('error');
        setMessage('잘못된 QR 코드입니다. (내용: ' + decodedText.substring(0, 15) + '...)');
      }
    };

    startScanner();

    // 페이지를 벗어날 때 카메라 리소스 해제
    return () => {
      if (qrScannerRef.current?.isScanning) {
        qrScannerRef.current.stop().catch(console.error);
      }
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* 상단 헤더 */}
      <div className="p-4 flex items-center gap-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">지점 인증하기</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* 라이브러리 기본 UI 제거 및 커스텀 스타일 */}
        <style jsx global>{`
          #reader { border: none !important; border-radius: 24px !important; overflow: hidden !important; }
          #reader__dashboard, #reader__camera_selection { display: none !important; }
          video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
        `}</style>

        {/* 스캐너 박스 */}
        <div className="w-full max-w-sm aspect-square relative z-10 overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900">
          <div id="reader" className="w-full h-full"></div>
          
          {/* 스캔 라인 효과 */}
          {status === 'scanning' && (
            <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none flex items-center justify-center z-20">
              <div className="w-full h-0.5 bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse"></div>
            </div>
          )}
        </div>

        {/* 메시지 영역 */}
        <div className="mt-10 text-center px-10 h-32 flex flex-col items-center justify-center">
          {status === 'processing' && <Loader2 className="animate-spin mb-4 text-zinc-400" size={32} />}
          <p className={`text-lg font-medium leading-relaxed ${status === 'error' ? 'text-red-400' : 'text-zinc-300'}`}>
            {message}
          </p>
          {status === 'error' && (
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-6 py-2 bg-zinc-800 rounded-full text-sm hover:bg-zinc-700 transition-colors"
            >
              다시 스캔하기
            </button>
          )}
        </div>
      </div>

      <div className="p-8 bg-zinc-900 text-center text-xs text-zinc-500 border-t border-zinc-800">
        <p className="flex items-center justify-center gap-2">
          <MapPin size={14} /> 지점별 QR 코드를 순서대로 스캔해주세요.
        </p>
      </div>
    </main>
  );
}