'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';

export default function ScanPage() {
  const router = useRouter();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const lastCoords = useRef<{lat: number, lng: number} | null>(null);
  const [status, setStatus] = useState<'loading' | 'scanning' | 'processing' | 'error'>('loading');
  const [message, setMessage] = useState('GPS 신호를 수신 대기 중입니다...');
  const [gpsReady, setGpsReady] = useState(false);

  useEffect(() => {
    let watchId: number;

    const startGpsTracking = () => {
      if (!navigator.geolocation) {
        setStatus('error');
        setMessage('이 브라우저는 GPS를 지원하지 않습니다.');
        return;
      }

      // 🚀 실시간 위치 추적 시작
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          console.log("GPS 수신 중:", pos.coords.latitude, pos.coords.longitude);
          lastCoords.current = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          
          if (!gpsReady) {
            setGpsReady(true);
            setMessage('GPS 수신 완료! 이제 스캔할 수 있습니다.');
            // 첫 신호가 잡히면 스캐너 시작
            if (status === 'loading') startScanner();
          }
        },
        (err) => {
          console.error("GPS 오류:", err);
          // 이미 신호를 한 번이라도 잡았다면 에러를 띄우지 않고 기존 좌표 유지
          if (!lastCoords.current) {
            setStatus('error');
            if (err.code === 1) setMessage('위치 권한을 허용해주세요.');
            else setMessage('GPS 신호가 약합니다. 실외로 이동해주세요.');
          }
        },
        { 
          enableHighAccuracy: true, // 🚀 가장 높은 정확도 강제
          maximumAge: 0,           // 캐시된 데이터 사용 안 함
          timeout: 20000            // 수신 대기 시간 20초로 연장
        }
      );
    };

    startGpsTracking();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
      stopScanner();
    };
  }, [gpsReady]);

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
      alert("GPS 신호가 아직 잡히지 않았습니다. 잠시만 기다려주세요.");
      return;
    }

    try { await stopScanner(); } catch (e) {}
    setStatus('processing');
    setMessage('인증 처리 중...');

    const { lat, lng } = lastCoords.current;
    
    // 🚀 URL 생성 로직 안전하게 변경
    const baseUrl = decodedText.includes('?') ? decodedText : `${decodedText}?`;
    const finalUrl = `${baseUrl}&lat=${lat}&lng=${lng}`;
    
    window.location.href = finalUrl;
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      <div className="p-4 flex items-center justify-between bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2"><ArrowLeft size={24} /></button>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${gpsReady ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-xs font-bold uppercase tracking-tighter">
            GPS: {gpsReady ? 'Active' : 'Searching'}
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm aspect-square relative overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900">
          <div id="reader" className="w-full h-full"></div>
          
          {(!gpsReady || status === 'loading' || status === 'processing') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-30">
              <Loader2 className="animate-spin text-red-500 mb-4" size={40} />
              <p className="text-sm font-black text-zinc-500 tracking-widest italic">
                {status === 'processing' ? 'VERIFYING...' : 'INITIALIZING GPS...'}
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 text-center px-10">
          <div className="flex items-center justify-center gap-2 mb-2 text-zinc-500">
            <MapPin size={16} />
            <span className="text-xs font-bold uppercase tracking-widest">Location Status</span>
          </div>
          <p className={`text-lg font-bold leading-tight ${status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>
            {message}
          </p>
          
          {status === 'error' && (
            <button onClick={() => window.location.reload()} className="mt-6 px-10 py-4 bg-red-600 rounded-2xl font-black">
              다시 시도하기
            </button>
          )}
        </div>
      </div>
    </main>
  );
}