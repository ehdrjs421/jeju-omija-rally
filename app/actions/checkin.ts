'use server';

import { createClient } from '@/utils/supabase/server';

// 지점별 실제 좌표 설정 (새별오름 예시 좌표)
const CHECKPOINTS_COORD = {
  START: { lat: 33.3615, lng: 126.3547 },
  MID: { lat: 33.3650, lng: 126.3560 },
  FINISH: { lat: 33.3615, lng: 126.3547 },
};

// 두 좌표 사이의 거리(m) 계산 함수
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
  userLat?: number, // 추가
  userLng?: number  // 추가
) {
  const supabase = await createClient();
  const currentPoint = point.toUpperCase() as keyof typeof CHECKPOINTS_COORD;

  // 1. GPS 거리 검증 (좌표가 넘어온 경우)
  if (userLat && userLng) {
    const target = CHECKPOINTS_COORD[currentPoint];
    const distance = getDistance(userLat, userLng, target.lat, target.lng);
    
    if (distance > 300) { // 300미터 이상이면 거부
      return { success: false, message: `지점과 너무 멉니다. (약 ${Math.round(distance)}m)` };
    }
  }

  try {
    // 2. 마지막 기록 조회 및 순서 검증 (기존 로직 동일)
    const { data: lastStamp } = await supabase
      .from('stamps')
      .select('checkpoint_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastPoint = lastStamp?.checkpoint_id?.toUpperCase();
    if (currentPoint === 'MID' && lastPoint !== 'START') return { success: false, message: '출발(START)을 먼저 하세요.' };
    if (currentPoint === 'FINISH' && lastPoint !== 'MID') return { success: false, message: '정상(MID)을 먼저 하세요.' };

    // 3. 스탬프 찍기 (GPS 좌표 포함 저장)
    const { error: stampError } = await supabase.from('stamps').insert({
      user_id: userId,
      checkpoint_id: currentPoint,
      gps_lat: userLat || 0, // DB 컬럼이 있다는 가정
      gps_lng: userLng || 0
    });

    if (stampError) throw stampError;

    let isFinish = false;
    if (currentPoint === 'FINISH') {
      await supabase.from('laps').insert({ user_id: userId });
      isFinish = true;
    }

    return { success: true, message: isFinish ? "완주 성공!" : `${currentPoint} 인증!`, isFinish };
  } catch (err: any) {
    return { success: false, message: "처리 중 오류가 발생했습니다." };
  }
}