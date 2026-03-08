'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function ScanPage() {
  const router = useRouter();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [status, setStatus] = useState<'scanning' | 'processing' | 'error'>('scanning');
  const [message, setMessage] = useState('카메라 권한을 확인 중입니다...');

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        qrScannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" }, 
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          onScanSuccess,
          () => {} 
        );
        setMessage('지점의 QR 코드를 스캔해주세요.');
      } catch (err) {
        setStatus('error');
        setMessage('카메라를 켤 수 없습니다. 권한 설정을 확인해주세요.');
      }
    };

    const onScanSuccess = async (decodedText: string) => {
      // 스캔 성공 시 카메라 즉시 중지
      if (qrScannerRef.current?.isScanning) {
        await qrScannerRef.current.stop();
      }

      setStatus('processing');
      setMessage('해당 지점으로 이동하고 있습니다...');

      // 🚀 [핵심 로직] 네이버 QR 주소(단축 URL)로 직접 이동시킵니다.
      // 이동하면 네이버가 알아서 우리 사이트의 ?point=START 주소로 보내줍니다.
      if (decodedText.startsWith('http')) {
        window.location.href = decodedText;
      } else {
        setStatus('error');
        setMessage('유효한 QR 코드 주소가 아닙니다.');
      }
    };

    startScanner();
    return () => {
      if (qrScannerRef.current?.isScanning) {
        qrScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

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
          #reader { border: none !important; border-radius: 24px !important; overflow: hidden !important; }
          #reader__dashboard, #reader__camera_selection { display: none !important; }
          video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
        `}</style>

        <div className="w-full max-w-sm aspect-square relative z-10 overflow-hidden rounded-[2.5rem] border-4 border-zinc-800 bg-zinc-900">
          <div id="reader" className="w-full h-full"></div>
          {status === 'scanning' && (
            <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none flex items-center justify-center z-20">
              <div className="w-full h-0.5 bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse"></div>
            </div>
          )}
        </div>

        <div className="mt-10 text-center px-10 h-32 flex flex-col items-center justify-center">
          {status === 'processing' && <Loader2 className="animate-spin mb-4 text-zinc-400" size={32} />}
          <p className={`text-lg font-medium leading-relaxed ${status === 'error' ? 'text-red-400' : 'text-zinc-300'}`}>
            {message}
          </p>
          {status === 'error' && (
            <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2 bg-zinc-800 rounded-full text-sm">
              다시 시도하기
            </button>
          )}
        </div>
      </div>
    </main>
  );
}