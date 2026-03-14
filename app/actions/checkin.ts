'use server';

import { createClient } from '@/utils/supabase/server';

const CHECKPOINTS_COORD = {
  START: { lat: 33.3637022, lng: 126.3577547 },
  // START: { lat: 37.52976, lng: 127.1150931 }, // 잠실 올림픽공원 기준 (전달해주신 좌표)
  MID: { lat: 33.3662736, lng: 126.3576163 },
  // MID : { lat: 37.52976, lng: 127.1150931 },
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

  // 1️⃣ GPS 거리 검증 (30m)
  if (userLat && userLng) {
    const target = CHECKPOINTS_COORD[currentPoint];
    const distance = getDistance(userLat, userLng, target.lat, target.lng);
    if (distance > 30) {
      return { 
        success: false, 
        message: `📍 [${currentName}] 지점과 너무 멉니다. (약 ${Math.round(distance)}m 거리) 해당 장소로 이동해주세요.` 
      };
    }
  } else {
    return { success: false, message: "위치 정보가 전송되지 않았습니다. GPS를 켜주세요." };
  }

  try {
    // 2️⃣ 현재 바퀴(Lap)의 진행 상태 파악
    // 마지막 완주 시간을 가져와서 그 이후의 스탬프만 필터링합니다.
    const { data: lastLap } = await supabase
      .from('laps')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastLapTime = lastLap?.created_at || '1970-01-01T00:00:00Z';

    const { data: currentStamps } = await supabase
      .from('stamps')
      .select('checkpoint_id')
      .eq('user_id', userId)
      .gt('created_at', lastLapTime)
      .order('created_at', { ascending: true }); // 시간 순으로 정렬

    const stampedPoints = currentStamps?.map(s => s.checkpoint_id.toUpperCase()) || [];
    const lastPoint = stampedPoints[stampedPoints.length - 1];

    // 3️⃣ 순서 및 중복 검증 로직 (핵심)
    
    // 이미 찍은 지점인지 확인
    if (stampedPoints.includes(currentPoint)) {
      return { success: false, message: `이미 [${currentName}] 인증을 완료했습니다. 다음 지점으로 이동하세요.` };
    }

    // 단계별 순서 제약
    if (currentPoint === 'MID') {
      // MID를 찍으려면 반드시 START가 먼저 찍혀있어야 함
      if (!stampedPoints.includes('START')) {
        return { success: false, message: '출발(START) 인증을 먼저 완료해야 합니다.' };
      }
    }

    if (currentPoint === 'FINISH') {
      // FINISH를 찍으려면 반드시 MID가 먼저 찍혀있어야 함
      if (!stampedPoints.includes('MID')) {
        return { success: false, message: '정상(MID) 인증을 먼저 완료해야 합니다.' };
      }
    }

    // 4️⃣ 스탬프 저장
    const { error: stampError } = await supabase.from('stamps').insert({
      user_id: userId,
      checkpoint_id: currentPoint,
      gps_lat: userLat,
      gps_lng: userLng
    });
    if (stampError) throw stampError;

    // 5️⃣ 완주 처리 (FINISH 인증 시)
    let isFinish = false;
    if (currentPoint === 'FINISH') {
      const { error: lapError } = await supabase.from('laps').insert({ user_id: userId });
      if (lapError) throw lapError;
      isFinish = true;
    }

    return { 
      success: true, 
      message: isFinish 
        ? "축하합니다! 모든 코스를 완주하셨습니다! 🍊" 
        : `✅ ${currentName} 인증 성공! 다음 지점으로 이동하세요.`, 
      isFinish 
    };

  } catch (err: any) {
    console.error("Check-in Error:", err);
    return { success: false, message: "처리 중 서버 오류가 발생했습니다." };
  }
}