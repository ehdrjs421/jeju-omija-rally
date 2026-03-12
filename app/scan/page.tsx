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
      setStatus('error');
      setMessage('카메라를 시작할 수 없습니다.');
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current?.isScanning) {
      try { await qrScannerRef.current.stop(); } catch (e) {}
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

      // 🚀 네이버 단축 URL 우회 및 우리 앱 주소로 재구성
      const myAppUrl = "https://jeju-omija-rally.pages.dev/rally";
      const scannedParams = new URLSearchParams(decodedText.split('?')[1]);
      const point = (scannedParams.get('point') || 'START').toUpperCase();

      const finalUrl = `${myAppUrl}?point=${point}&lat=${lastCoords.current.lat}&lng=${lastCoords.current.lng}`;
      window.location.href = finalUrl;
    } catch (e) {
      setStatus('scanning');
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      <div className="p-4 flex items-center gap-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2 active:scale-95"><ArrowLeft size={24} /></button>
        <h1 className="text-xl font-bold">지점 인증</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm aspect-square relative overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900 shadow-2xl">
          <div id="reader" className="w-full h-full"></div>
          {status !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-30">
              <Loader2 className="animate-spin text-red-500 mb-4" size={40} />
              <p className="text-sm font-black text-zinc-500 tracking-widest uppercase">
                {status === 'loading' ? 'GPS WAITING' : 'PROCESSING...'}
              </p>
            </div>
          )}
        </div>
        <p className="mt-8 text-zinc-400 font-bold">{message}</p>
      </div>
    </main>
  );
}