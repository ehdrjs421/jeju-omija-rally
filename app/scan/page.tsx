'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ScanPage() {
  const router = useRouter();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'processing' | 'error'>('loading');
  const [message, setMessage] = useState('시스템 준비 중...');

  useEffect(() => {
    const initSystem = async () => {
      try {
        setMessage('GPS 신호를 수신 중입니다...');
        
        // 🚀 [수정] 단순히 권한만 묻는게 아니라, 위치 데이터가 올 때까지 최대 10초 대기
        const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => reject(err),
            { 
              enableHighAccuracy: true, 
              timeout: 10000, // 10초 대기
              maximumAge: 0   // 캐시된 위치 대신 실시간 위치 사용
            }
          );
        });

        if (coords) {
          console.log("GPS 수신 성공:", coords.latitude, coords.longitude);
          startScanner();
        }
      } catch (err: any) {
        console.error("Permission/GPS Error:", err);
        setStatus('error');
        if (err.code === 1) {
          setMessage('위치 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
        } else if (err.code === 3) {
          setMessage('GPS 신호가 약합니다. 탁 트인 곳에서 다시 시도해주세요.');
        } else {
          setMessage('카메라와 위치 권한이 모두 필요합니다.');
        }
      }
    };

    const timer = setTimeout(initSystem, 1000); // 1초 여유 준 뒤 시작
    return () => { stopScanner(); };
  }, []);

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
    // 🚀 중복 실행 방지
    if (status === 'processing') return;
    
    try { await stopScanner(); } catch (e) {}
    setStatus('processing');
    setMessage('최종 위치 확인 중...');

    // 🚀 스캔 직후 위치를 한 번 더 확실히 잡습니다.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const url = new URL(decodedText, window.location.origin);
        url.searchParams.set('lat', latitude.toString());
        url.searchParams.set('lng', longitude.toString());
        
        console.log("최종 전송 주소:", url.toString());
        window.location.href = url.toString();
      },
      (err) => {
        console.error("스캔 후 위치 획득 실패:", err);
        setStatus('error');
        setMessage('인증 직전 위치 확인에 실패했습니다. 다시 시도해주세요.');
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  // UI 부분은 기존과 동일
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
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-tighter">{status}</p>
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
              className="mt-6 px-10 py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all"
            >
              다시 시도하기
            </button>
          )}
        </div>
      </div>
    </main>
  );
}