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

  useEffect(() => {
    // 🚀 GPS 실시간 추적 시작
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        console.log("📍 GPS 수신 성공:", pos.coords.latitude, pos.coords.longitude);
        lastCoords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        
        // 위치를 잡으면 스캐너를 시작합니다.
        if (status === 'loading') {
          startScanner();
        }
      },
      (err) => {
        console.error("❌ GPS 수신 실패:", err);
        if (!lastCoords.current) {
          setStatus('error');
          setMessage('GPS 권한이 필요합니다. 설정에서 위치 권한을 허용해주세요.');
        }
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 0, 
        timeout: 10000 
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      stopScanner();
    };
  }, [status]);

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode("reader");
      qrScannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 15, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {}
      );
      setStatus('scanning');
      setMessage('QR 코드를 스캔해주세요.');
    } catch (err) {
      console.error("❌ 카메라 시작 오류:", err);
      setStatus('error');
      setMessage('카메라를 시작할 수 없습니다.');
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current?.isScanning) {
      try {
        await qrScannerRef.current.stop();
      } catch (e) {
        console.error("❌ 스캐너 중지 오류:", e);
      }
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    if (status === 'processing') return;

    // GPS 데이터가 없으면 진행 불가
    if (!lastCoords.current) {
      alert("📍 GPS 신호를 아직 기다리는 중입니다. 잠시 후 다시 스캔해주세요.");
      return;
    }

    try {
      await stopScanner();
      setStatus('processing');
      setMessage('위치 정보를 전송 중입니다...');

      // 🚀 URL 파라미터 병합 (안전한 방식)
      const url = new URL(decodedText, window.location.origin);
      
      url.searchParams.set('lat', lastCoords.current.lat.toString());
      url.searchParams.set('lng', lastCoords.current.lng.toString());

      console.log("🚀 최종 이동 URL:", url.toString());
      
      // 즉시 이동
      window.location.href = url.toString();
    } catch (e) {
      console.error("❌ URL 생성 또는 이동 실패:", e);
      // URL 형식이 아닐 경우를 대비한 대체 로직
      const separator = decodedText.includes('?') ? '&' : '?';
      window.location.href = `${decodedText}${separator}lat=${lastCoords.current.lat}&lng=${lastCoords.current.lng}`;
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* 헤더 */}
      <div className="p-4 flex items-center gap-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2 active:scale-95">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">지점 인증</h1>
      </div>

      {/* 스캐너 영역 */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm aspect-square relative overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900 shadow-2xl">
          <div id="reader" className="w-full h-full"></div>
          
          {status !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-30">
              <Loader2 className="animate-spin text-red-500 mb-4" size={40} />
              <p className="text-sm font-black text-zinc-500 uppercase tracking-widest italic">
                {status === 'loading' ? 'GPS WAITING' : 'PROCESSING...'}
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
            className="mt-6 px-10 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all"
          >
            다시 시도하기
          </button>
        )}
      </div>
    </main>
  );
}