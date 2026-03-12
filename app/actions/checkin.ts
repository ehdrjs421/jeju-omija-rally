'use server';

import { createClient } from '@/utils/supabase/server';

const CHECKPOINTS_COORD = {
  // START: { lat: 33.363414, lng: 126.357822 },
  START: { lat: 37.52976, lng: 127.1150931 }, // 잠실 올림픽공원 기준 (전달해주신 좌표)
  MID: { lat: 33.3662736, lng: 126.3576163 }, 
  FINISH: { lat: 33.365741, lng: 126.361036 }
};

const POINT_NAMES = { START: '출발', MID: '정상', FINISH: '도착' };

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
  const supabase = await createClient();
  const currentPoint = point.toUpperCase() as keyof typeof CHECKPOINTS_COORD;
  const currentName = POINT_NAMES[currentPoint];

  // 1️⃣ GPS 거리 검증 (300m)
  if (userLat && userLng) {
    const target = CHECKPOINTS_COORD[currentPoint];
    const distance = getDistance(userLat, userLng, target.lat, target.lng);
    if (distance > 300) {
      return { success: false, message: `[${currentName}] 지점과 너무 멉니다. (약 ${Math.round(distance)}m 거리) 해당 장소로 이동해주세요.` };
    }
  } else {
    return { success: false, message: "위치 정보가 전송되지 않았습니다." };
  }

  try {
    // 2️⃣ 순서 검증
    const { data: lastStamp } = await supabase
      .from('stamps')
      .select('checkpoint_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastPoint = lastStamp?.checkpoint_id?.toUpperCase();
    if (currentPoint === 'MID' && lastPoint !== 'START') return { success: false, message: '출발 지점을 먼저 스캔하세요.' };
    if (currentPoint === 'FINISH' && lastPoint !== 'MID') return { success: false, message: '정상 지점을 먼저 스캔하세요.' };

    // 3️⃣ 스탬프 저장
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

    return { 
      success: true, 
      message: isFinish ? "축하합니다! 완주에 성공하셨습니다! 🍊" : `${currentName} 지점 인증 성공!`, 
      isFinish 
    };
  } catch (err: any) {
    return { success: false, message: "처리 중 오류가 발생했습니다." };
  }
}