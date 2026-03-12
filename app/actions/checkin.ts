'use server'

import { createClient } from '@/utils/supabase/server'

// userName을 추가로 받아야 users 테이블 upsert 시 이름을 정확히 넣을 수 있습니다.
export async function handleCheckIn(point: 'START' | 'MID' | 'FINISH', userId: string, userName?: string) {
  const supabase = await createClient()

  if (!userId) return { success: false, message: '유저 정보가 유효하지 않습니다.' }

  try {
    // 🚀 [추가] Foreign Key 에러 방지: 유저가 DB에 없으면 먼저 등록합니다.
    // bib_number는 스키마상 NOT NULL이므로 임시값을 생성해 넣어줍니다.
    const { error: userError } = await supabase.from('users').upsert({
      id: userId,
      name: userName || '참가자',
      bib_number: `BIB-${userId.slice(0, 8)}`, // 중복 방지를 위해 ID 일부 활용
      status: 'READY'
    }, { onConflict: 'id' });

    if (userError) {
        console.error("User registration error:", userError.message);
        return { success: false, message: '유저 등록 실패: ' + userError.message };
    }

    // 마지막 스탬프 조회
    const { data: lastCheckIn } = await supabase
      .from('stamps')
      .select('checkpoint_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastPoint = lastCheckIn?.checkpoint_id?.toUpperCase();
    const currentPoint = point.toUpperCase();

    // 1. 검증 로직
    if (currentPoint === 'MID' && lastPoint !== 'START') {
      return { success: false, message: 'START 지점을 먼저 인증해야 합니다.' }
    }
    if (currentPoint === 'FINISH' && lastPoint !== 'MID') {
      return { success: false, message: 'MID(정상) 지점을 먼저 인증해야 합니다.' }
    }
    // START를 이미 찍었는데 또 START를 찍으려는 경우 (중복 방지 선택 사항)
    if (currentPoint === 'START' && lastPoint === 'START') {
        return { success: false, message: '이미 START 인증을 완료했습니다. MID로 이동하세요.' }
    }

    // 2. 서버에서 직접 stamps insert
    const { error: stampError } = await supabase.from('stamps').insert({
      user_id: userId,
      checkpoint_id: currentPoint,
      is_valid: true // 스키마에 따라 true 설정
    })

    if (stampError) return { success: false, message: '스탬프 기록 실패: ' + stampError.message }

    // 3. FINISH면 laps 추가
    if (currentPoint === 'FINISH') {
      const { error: lapError } = await supabase.from('laps').insert({ 
        user_id: userId,
        // 만약 DB에서 lap_number가 자동증가가 아니라면 여기서 값을 계산해 넣어야 할 수도 있습니다.
      })
      
      if (lapError) {
          console.error("Laps insert error:", lapError.message);
          // 랩 기록은 실패해도 일단 완주는 성공으로 처리하거나, 에러를 알립니다.
      }
      
      return { success: true, message: '🎊 축하합니다! 완주 성공! 🎊', isFinish: true }
    }

    return { success: true, message: `${currentPoint} 인증 성공!`, isFinish: false }

  } catch (err: any) {
    console.error("Unexpected error:", err);
    return { success: false, message: '서버 오류가 발생했습니다.' };
  }
}