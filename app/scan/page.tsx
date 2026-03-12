'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ScanPage() {
  const router = useRouter();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'processing' | 'error'>('loading');
  const [message, setMessage] = useState('권한 확인 중...');

  useEffect(() => {
    const initSystem = async () => {
      try {
        // 🚀 위치 권한 미리 요청
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        startScanner();
      } catch (err) {
        setStatus('error');
        setMessage('카메라와 위치 정보 권한이 모두 필요합니다.');
      }
    };
    initSystem();
    return () => { stopScanner(); };
  }, []);

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode("reader");
      qrScannerRef.current = html5QrCode;
      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {}
      );
      setStatus('scanning');
      setMessage('지점의 QR 코드를 스캔하세요.');
    } catch (err) {
      setStatus('error');
      setMessage('카메라를 시작할 수 없습니다.');
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current?.isScanning) {
      await qrScannerRef.current.stop();
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    try { await stopScanner(); } catch (e) {}
    setStatus('processing');
    setMessage('위치 확인 및 인증 중...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const url = new URL(decodedText, window.location.origin);
        url.searchParams.set('lat', latitude.toString());
        url.searchParams.set('lng', longitude.toString());
        window.location.href = url.toString();
      },
      () => {
        setStatus('error');
        setMessage('위치 정보를 가져올 수 없습니다. GPS를 확인해주세요.');
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      <div className="p-4 flex items-center gap-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2"><ArrowLeft size={24} /></button>
        <h1 className="text-xl font-bold">지점 인증하기</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm aspect-square relative overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900 shadow-2xl">
          <div id="reader" className="w-full h-full"></div>
          {status !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-30">
              <Loader2 className="animate-spin text-red-500 mb-2" size={32} />
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-tighter">{status}</p>
            </div>
          )}
        </div>
        <div className="mt-10 text-center px-10">
          <p className={`text-lg font-bold ${status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>{message}</p>
          {status === 'error' && (
            <button onClick={() => window.location.reload()} className="mt-4 px-8 py-3 bg-zinc-800 rounded-2xl font-bold">다시 시도</button>
          )}
        </div>
      </div>
    </main>
  );
}