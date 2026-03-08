'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ArrowLeft, MapPin, CameraOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function ScanPage() {
  const router = useRouter();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [status, setStatus] = useState<'scanning' | 'processing' | 'success' | 'error'>('scanning');
  const [message, setMessage] = useState('지점의 QR 코드를 사각형 안에 맞춰주세요.');

  useEffect(() => {
    // 1. 스캐너 초기화 (중복 방지를 위해 ref 사용)
    if (!scannerRef.current) {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true, // 플래시 버튼 지원
        },
        /* verbose= */ false
      );
    }

    const onScanSuccess = async (decodedText: string) => {
      // 스캔 성공 시 즉시 중단하여 중복 실행 방지
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
      
      setStatus('processing');
      setMessage('위치 정보를 확인하고 있습니다...');

      const savedUser = localStorage.getItem('omija_user');
      if (!savedUser) return router.push('/');
      const user = JSON.parse(savedUser);

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;

            const { error } = await supabase.from('stamps').insert({
              user_id: user.id,
              checkpoint_id: decodedText, 
              gps_lat: latitude,
              gps_lng: longitude,
            });

            if (error) {
              setStatus('error');
              setMessage('인증 실패: ' + error.message);
            } else {
              setStatus('success');
              setMessage('인증 성공! 다음 지점으로 이동하세요.');
              setTimeout(() => router.push('/rally'), 2000);
            }
          },
          (geoError) => {
            setStatus('error');
            setMessage('GPS 권한이 거부되었습니다. 위치 권한을 허용해주세요.');
          }
        );
      }
    };

    scannerRef.current.render(onScanSuccess, (err) => {
      // 스캔 시도 중 오류 무시
    });

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* 상단 바 */}
      <div className="p-4 flex items-center gap-4 bg-zinc-900 border-b border-zinc-800">
        <button onClick={() => router.back()} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold font-sans">지점 인증하기</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {/* 🚀 중요: html5-qrcode의 기본 UI를 덮어씌우는 스타일 CSS */}
        <style jsx global>{`
          #reader {
            border: none !important;
            border-radius: 24px !important;
            overflow: hidden !important;
          }
          #reader__dashboard {
            background-color: transparent !important;
            padding: 10px !important;
            color: white !important;
          }
          #reader__camera_selection {
            background: #27272a !important;
            color: white !important;
            border-radius: 8px !important;
            padding: 5px !important;
            margin-bottom: 10px !important;
          }
          #reader button {
            background-color: #ef4444 !important;
            color: white !important;
            border: none !important;
            padding: 8px 16px !important;
            border-radius: 8px !important;
            font-weight: bold !important;
            cursor: pointer !important;
          }
          video {
            width: 100% !important;
            height: 100% !important;
            object-fit: cover !important;
          }
        `}</style>

        <div className="w-full max-w-sm aspect-square relative z-10 overflow-hidden rounded-[2.5rem] border-4 border-zinc-800">
          <div id="reader" className="w-full h-full"></div>
          
          {/* 스캐닝 효과 오버레이 */}
          {status === 'scanning' && (
            <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none flex items-center justify-center z-20">
              <div className="w-full h-0.5 bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse"></div>
            </div>
          )}
        </div>

        {/* 상태 메시지 */}
        <div className="mt-10 text-center px-10 h-24">
          {status === 'processing' && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>}
          <p className={`text-lg font-medium leading-relaxed ${status === 'error' ? 'text-red-400' : 'text-zinc-300'}`}>
            {message}
          </p>
        </div>
      </div>

      <div className="p-8 bg-zinc-900 text-center text-xs text-zinc-500 border-t border-zinc-800">
        <p className="flex items-center justify-center gap-2">
          <MapPin size={14} /> GPS 위치 기반 인증 활성화
        </p>
      </div>
    </main>
  );
}