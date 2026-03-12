'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ScanPage() {
  const router = useRouter();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const lastCoords = useRef<{ lat: number, lng: number } | null>(null);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'processing' | 'error'>('loading');
  const [message, setMessage] = useState('GPS 신호를 수신 중입니다...');

  // 1. GPS 감시 및 스캐너 시작 제어
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastCoords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        // GPS를 잡으면 로딩 상태를 끝내고 스캐너를 시작합니다.
        if (status === 'loading') startScanner();
      },
      (err) => {
        console.error("GPS Error:", err);
        if (!lastCoords.current) {
          setStatus('error');
          setMessage('GPS 권한이 필요합니다. 설정에서 위치 권한을 허용해주세요.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      stopScanner();
    };
  }, [status]);

  // 2. 스캐너 시작 함수
  const startScanner = async () => {
    try {
      if (qrScannerRef.current?.isScanning) return; // 이미 실행 중이면 중단

      const html5QrCode = new Html5Qrcode("reader");
      qrScannerRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {} // 스캔 실패(미인식) 시에는 아무것도 하지 않음
      );
      
      setStatus('scanning');
      setMessage('QR 코드를 스캔해주세요.');
    } catch (err) {
      console.error("Scanner Start Error:", err);
      setStatus('error');
      setMessage('카메라를 시작할 수 없습니다.');
    }
  };

  // 3. 스캐너 정지 함수 (비동기 처리 보강)
  const stopScanner = async () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current = null; // 메모리 해제
      } catch (e) {
        console.warn("Scanner Stop Warning:", e);
      }
    }
  };

  // 4. 스캔 성공 시 처리 로직
  const onScanSuccess = async (decodedText: string) => {
    // 중복 실행 방지
    if (status === 'processing') return;

    if (!lastCoords.current) {
      alert("📍 GPS 신호를 아직 기다리는 중입니다. 잠시 후 다시 스캔해주세요.");
      return;
    }

    try {
      // 🚀 스캐너를 즉시 멈춰 중복 스캔과 'payload' 관련 에러를 방지합니다.
      await stopScanner();
      setStatus('processing');

      // 🔍 [포인트 추출] URL 객체와 정규식을 모두 사용하여 point를 찾습니다.
      let point: string | undefined;
      
      try {
        const urlObj = new URL(decodedText.includes('http') ? decodedText : `https://temp.com${decodedText}`);
        point = urlObj.searchParams.get('point')?.toUpperCase() ?? undefined;
      } catch (e) {
        point = undefined;
      }

      if (!point) {
        const match = decodedText.match(/[?&]point=([^&]+)/i);
        point = match ? match[1].toUpperCase() : undefined;
      }

      // ❌ [검증] 유효한 포인트가 아니면 다시 스캔
      if (!point || !['START', 'MID', 'FINISH'].includes(point)) {
        alert(`잘못된 인증 코드입니다.\n스캔 내용: ${decodedText}`);
        setStatus('scanning');
        setMessage('QR 코드를 다시 스캔해주세요.');
        startScanner(); // 재시작
        return;
      }

      // ✅ [이동] 사용자가 요청한 주소 형식으로 리다이렉트
      const myAppUrl = "https://jeju-omija-rally.pages.dev/rally";
      const finalUrl = `${myAppUrl}?point=${point}&lat=${lastCoords.current.lat}&lng=${lastCoords.current.lng}`;
      
      console.log("🚀 Redirecting to:", finalUrl);
      window.location.href = finalUrl;

    } catch (e) {
      console.error("Processing Error:", e);
      alert("인증 처리 중 오류가 발생했습니다.");
      setStatus('scanning');
      startScanner();
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* 헤더 */}
      <div className="p-4 flex items-center gap-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2 active:scale-95 hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold italic tracking-tight uppercase">Point Check-in</h1>
      </div>

      {/* 스캐너 컨테이너 */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm aspect-square relative overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900 shadow-2xl">
          <div id="reader" className="w-full h-full"></div>
          
          {/* 로딩/처리 중 오버레이 */}
          {status !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 z-30 backdrop-blur-sm">
              <Loader2 className="animate-spin text-red-500 mb-4" size={48} />
              <p className="text-sm font-black text-zinc-400 tracking-widest uppercase">
                {status === 'loading' ? 'GPS Searching...' : 'Validating...'}
              </p>
            </div>
          )}
        </div>

        {/* 안내 메시지 */}
        <p className={`mt-10 text-center px-10 text-lg font-bold leading-tight ${status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>
          {message}
        </p>

        {status === 'error' && (
          <button 
            onClick={() => window.location.reload()} 
            className="mt-6 px-10 py-4 bg-red-600 text-white rounded-2xl font-black active:scale-95 transition-transform"
          >
            다시 시도하기
          </button>
        )}
      </div>
    </main>
  );
}