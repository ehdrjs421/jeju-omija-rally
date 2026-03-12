'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, Loader2, Camera } from 'lucide-react';

export default function ScanPage() {
  const router = useRouter();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'processing' | 'error'>('loading');
  const [message, setMessage] = useState('카메라 준비 중...');

  useEffect(() => {
    // iOS Safari 대응을 위해 약간의 지연 후 시작
    const timer = setTimeout(() => {
      startScanner();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode("reader");
      qrScannerRef.current = html5QrCode;

      // 후면 카메라 우선 순위 설정
      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0 
      };

      // iOS에서 전면/후면 선택 이슈를 방지하기 위해 environment 모드 강제
      await html5QrCode.start(
        { facingMode: "environment" }, // 후면 카메라 지향
        config,
        onScanSuccess,
        () => {} // 스캔 중 에러는 무시
      );
      
      setStatus('scanning');
      setMessage('지점의 QR 코드를 스캔해주세요.');
    } catch (err: any) {
      console.error("Scanner Error:", err);
      setStatus('error');
      // 권한 거부 시 메시지 세분화
      if (err.includes("NotAllowedError") || err.includes("Permission denied")) {
        setMessage('카메라 권한이 거부되었습니다. 설정에서 브라우저의 카메라 권한을 허용해주세요.');
      } else {
        setMessage('후면 카메라를 찾을 수 없거나 사용 중입니다.');
      }
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current = null;
      } catch (err) {
        console.error("Stop Error:", err);
      }
    }
  };

  const onScanSuccess = async (decodedText: string) => {
  await stopScanner();
  setStatus('processing');
  setMessage('위치 정보를 확인 중입니다...');

  // 🛰️ GPS 좌표 가져오기
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      
      // 기존 QR 결과 주소(예: /rally?point=START) 뒤에 좌표 파라미터 추가
      const finalUrl = `${decodedText}&lat=${latitude}&lng=${longitude}`;
      
      setMessage('지점 인증 중...');
      window.location.href = finalUrl;
    },
    (error) => {
      console.warn("GPS 획득 실패:", error);
      // GPS 실패 시에도 일단 보냄 (서버에서 필수 여부 판단)
      window.location.href = decodedText;
    },
    { 
      enableHighAccuracy: true, // 높은 정확도 (배터리 사용량 증가하지만 정확함)
      timeout: 5000,            // 5초 내에 못 잡으면 실패 처리
      maximumAge: 0             // 캐시된 위치 사용 안 함
    }
  );
};

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
          #reader { border: none !important; border-radius: 2.5rem !important; overflow: hidden !important; }
          #reader__dashboard, #reader__camera_selection { display: none !important; }
          video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
        `}</style>

        <div className="w-full max-w-sm aspect-square relative z-10 overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900 shadow-2xl shadow-red-500/10">
          <div id="reader" className="w-full h-full"></div>
          
          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-30">
              <Loader2 className="animate-spin text-zinc-500 mb-2" size={32} />
              <p className="text-xs text-zinc-500 font-bold tracking-tighter">CAMERA INITIALIZING</p>
            </div>
          )}

          {status === 'scanning' && (
            <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none flex items-center justify-center z-20">
              <div className="w-full h-0.5 bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse"></div>
            </div>
          )}
        </div>

        <div className="mt-10 text-center px-10 h-32 flex flex-col items-center justify-center">
          {status === 'processing' && <Loader2 className="animate-spin mb-4 text-red-500" size={32} />}
          <p className={`text-lg font-bold leading-relaxed ${status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>
            {message}
          </p>
          {status === 'error' && (
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-8 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-sm font-bold transition-all active:scale-95"
            >
              다시 시도하기
            </button>
          )}
        </div>
      </div>
    </main>
  );
}