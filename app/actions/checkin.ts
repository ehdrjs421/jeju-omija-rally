// actions/checkin.ts
'use server'

import { createClient } from '@/utils/supabase/server'

export async function handleCheckIn(point: 'START' | 'MID' | 'FINISH', userId: string) {
  const supabase = await createClient()

  if (!userId) return { success: false, message: '유저 정보가 유효하지 않습니다.' }

  const { data: lastCheckIn } = await supabase
    .from('stamps')
    .select('checkpoint_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastPoint = lastCheckIn?.checkpoint_id?.toUpperCase();
  const currentPoint = point.toUpperCase();

  // 검증
  if (currentPoint === 'MID' && lastPoint !== 'START') {
    return { success: false, message: 'START 지점을 먼저 인증해야 합니다.' }
  }
  if (currentPoint === 'FINISH' && lastPoint !== 'MID') {
    return { success: false, message: 'MID(정상) 지점을 먼저 인증해야 합니다.' }
  }

  // ✅ 서버에서 직접 insert (FK 문제 없음)
  const { error: stampError } = await supabase.from('stamps').insert({
    user_id: userId,
    checkpoint_id: currentPoint,
  })

  if (stampError) return { success: false, message: stampError.message }

  // FINISH면 laps도 추가
  if (currentPoint === 'FINISH') {
    await supabase.from('laps').insert({ user_id: userId })
    return { success: true, message: '완주 성공!', isFinish: true }
  }

  return { success: true, message: `${currentPoint} 인증 성공!`, isFinish: false }
}