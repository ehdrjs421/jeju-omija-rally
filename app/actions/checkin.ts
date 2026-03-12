'use server';

import { createClient } from '@/utils/supabase/server';

// 📍 지점별 목표 좌표 (전달해주신 좌표 반영)
const CHECKPOINTS_COORD = {
  START: { lat: 33.363414, lng: 126.357822 }, 
  MID: { lat: 33.3662736, lng: 126.3576163 }, 
  FINISH: { lat: 33.365741, lng: 126.361036 }
};

// 📏 두 좌표 사이의 거리(m)를 구하는 함수
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function handleCheckIn(
  point: 'START' | 'MID' | 'FINISH', 
  userId: string, 
  userName?: string,
  userLat?: number, 
  userLng?: number
) {
  console.log("🔥🔥 [SERVER ACTION] 인증 시도:", { point, userId, userLat, userLng });
  const supabase = await createClient();
  const currentPoint = point.toUpperCase() as keyof typeof CHECKPOINTS_COORD;

  // 1️⃣ GPS 거리 검증
  if (userLat && userLng) {
    const target = CHECKPOINTS_COORD[currentPoint];
    const distance = getDistance(userLat, userLng, target.lat, target.lng);
    
    // 300미터 이상이면 거부
    if (distance > 300) {
      return { 
        success: false, 
        message: `지점과 너무 멉니다. (약 ${Math.round(distance)}m 거리) 해당 장소로 이동 후 스캔해주세요.` 
      };
    }
  } else {
    return { success: false, message: "위치 정보가 전송되지 않았습니다. GPS 권한을 허용해주세요." };
  }

  try {
    // 2️⃣ 순서 검증 로직
    const { data: lastStamp } = await supabase
      .from('stamps')
      .select('checkpoint_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastPoint = lastStamp?.checkpoint_id?.toUpperCase();
    if (currentPoint === 'MID' && lastPoint !== 'START') return { success: false, message: '출발(START)을 먼저 스캔하세요.' };
    if (currentPoint === 'FINISH' && lastPoint !== 'MID') return { success: false, message: '정상(MID)을 먼저 스캔하세요.' };

    // 3️⃣ 스탬프 저장 (GPS 좌표 포함)
    const { error: stampError } = await supabase.from('stamps').insert({
      user_id: userId,
      checkpoint_id: currentPoint,
      gps_lat: userLat,
      gps_lng: userLng
    });

    if (stampError) throw stampError;

    // 4️⃣ 완주 처리
    let isFinish = false;
    if (currentPoint === 'FINISH') {
      await supabase.from('laps').insert({ user_id: userId });
      isFinish = true;
    }

    return { success: true, message: isFinish ? "완주를 축하합니다!" : `${currentPoint} 지점 인증 성공!`, isFinish };
  } catch (err: any) {
    console.error("인증 실패:", err.message);
    return { success: false, message: "DB 저장 중 오류가 발생했습니다." };
  }
}