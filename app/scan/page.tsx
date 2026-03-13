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
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastCoords.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
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

  const startScanner = async () => {
    try {
      if (qrScannerRef.current?.isScanning) return;
      const html5QrCode = new Html5Qrcode("reader");
      qrScannerRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        { 
          fps: 15, 
          qrbox: (viewfinderWidth, viewfinderHeight) => {
          // 짧은 쪽의 75%를 정사각형으로
          const size = Math.min(viewfinderWidth, viewfinderHeight) * 0.75;
          return { width: size, height: size };
          }
        },
        onScanSuccess,
        () => {}
      );
      
      
      setStatus('scanning');
      setMessage('QR 코드를 스캔해주세요.');
    } catch (err) {
      setStatus('error');
      setMessage('카메라를 시작할 수 없습니다.');
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current = null;
      } catch (e) {}
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    if (status === 'processing') return;
    if (!lastCoords.current) {
      alert("📍 GPS 신호를 아직 기다리는 중입니다.");
      return;
    }

    try {
      await stopScanner();
      setStatus('processing');

      let point: string | undefined;

      // 🚀 네이버 단축 URL 코드별 강제 매핑
      if (decodedText.includes('22j3h')) {
        point = 'START';
      } else if (decodedText.includes('22j4B')) {
        point = 'MID';
      } else if (decodedText.includes('22j5e')) {
        point = 'FINISH';
      } else {
        // 일반 파라미터 추출
        const urlObj = new URL(decodedText.includes('http') ? decodedText : `https://temp.com${decodedText}`);
        point = urlObj.searchParams.get('point')?.toUpperCase() ?? undefined;
        if (!point) {
          const match = decodedText.match(/[?&]point=([^&]+)/i);
          point = match ? match[1].toUpperCase() : undefined;
        }
      }

      if (!point || !['START', 'MID', 'FINISH'].includes(point)) {
        alert(`잘못된 인증 코드입니다.\n스캔 내용: ${decodedText}`);
        setStatus('scanning');
        startScanner();
        return;
      }

      // Rally 페이지로 이동 (좌표 포함)
      const finalUrl = `/rally?point=${point}&lat=${lastCoords.current.lat}&lng=${lastCoords.current.lng}`;
      router.push(finalUrl);

    } catch (e) {
      console.error(e);
      setStatus('scanning');
      startScanner();
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      <div className="p-4 flex items-center gap-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2 active:scale-95"><ArrowLeft size={24} /></button>
        <h1 className="text-xl font-bold italic tracking-tight uppercase">Point Check-in</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm aspect-square relative overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900 shadow-2xl">
          <div id="reader" className="w-full h-full"></div>
          {status !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 z-30 backdrop-blur-sm">
              <Loader2 className="animate-spin text-red-500 mb-4" size={48} />
              <p className="text-sm font-black text-zinc-400 tracking-widest uppercase">
                {status === 'loading' ? 'GPS Searching...' : 'Validating...'}
              </p>
            </div>
          )}
        </div>
        <p className={`mt-10 text-center px-10 text-lg font-bold leading-tight ${status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>
          {message}
        </p>
      </div>
    </main>
  );
}