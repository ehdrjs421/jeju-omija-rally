'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ScanPage() {
  const router = useRouter();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const lastCoords = useRef<{lat: number, lng: number} | null>(null); // 최신 좌표 보관함
  const [status, setStatus] = useState<'loading' | 'scanning' | 'processing' | 'error'>('loading');
  const [message, setMessage] = useState('시스템 준비 중...');

  useEffect(() => {
    let watchId: number;

    const initSystem = async () => {
      try {
        setMessage('GPS 신호를 잡고 있습니다...');
        
        // 🚀 [핵심 수정 1] 위치를 계속 추적(Watch)하여 lastCoords에 실시간 저장
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            lastCoords.current = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude
            };
            // 좌표가 처음으로 잡히면 스캐너 시작
            if (status === 'loading') {
              startScanner();
            }
          },
          (err) => {
            console.error("GPS Watch Error:", err);
            if (!lastCoords.current) {
              setStatus('error');
              setMessage('GPS 신호가 잡히지 않습니다. 위치 권한을 확인하고 탁 트인 곳으로 이동해주세요.');
            }
          },
          { enableHighAccuracy: true, maximumAge: 0 }
        );

        // 10초 동안 좌표가 안 잡히면 에러 표시
        setTimeout(() => {
          if (status === 'loading' && !lastCoords.current) {
            setStatus('error');
            setMessage('위치 정보를 가져오는 데 시간이 너무 오래 걸립니다. 다시 시도해주세요.');
          }
        }, 10000);

      } catch (err) {
        setStatus('error');
        setMessage('시스템 초기화 중 오류가 발생했습니다.');
      }
    };

    initSystem();
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
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
      setMessage('지점의 QR 코드를 스캔하세요.');
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

    // 🚀 [핵심 수정 2] 스캔 순간, 이미 잡혀있는 실시간 좌표(lastCoords)를 즉시 사용
    if (!lastCoords.current) {
      alert("아직 위치 정보가 수신되지 않았습니다. 잠시만 기다려주세요.");
      return;
    }

    try { await stopScanner(); } catch (e) {}
    setStatus('processing');
    setMessage('인증 페이지로 이동 중...');

    const { lat, lng } = lastCoords.current;
    const url = new URL(decodedText, window.location.origin);
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lng', lng.toString());
    
    // 이동
    window.location.href = url.toString();
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      <div className="p-4 flex items-center gap-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2 active:scale-95"><ArrowLeft size={24} /></button>
        <h1 className="text-xl font-bold">지점 인증하기</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm aspect-square relative overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900 shadow-2xl">
          <div id="reader" className="w-full h-full"></div>
          {status !== 'scanning' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-30">
              <Loader2 className="animate-spin text-red-500 mb-2" size={32} />
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-tighter">
                {status === 'loading' ? 'GPS WAITING' : 'PROCESSING'}
              </p>
            </div>
          )}
        </div>
        <div className="mt-10 text-center px-10">
          <p className={`text-lg font-bold leading-tight ${status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>
            {message}
          </p>
          {status === 'error' && (
            <button 
              onClick={() => window.location.reload()} 
              className="mt-6 px-10 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg active:scale-95"
            >
              다시 시도하기
            </button>
          )}
        </div>
      </div>
    </main>
  );
}