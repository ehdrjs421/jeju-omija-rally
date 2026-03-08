// app/actions/checkin.ts
'use server'

import { createClient } from '@/utils/supabase/server'

export async function handleCheckIn(point: 'START' | 'MID' | 'FINISH', userId: string) {
  const supabase = await createClient()

  if (!userId) return { success: false, message: '유저 정보가 유효하지 않습니다.' }

  // 최신 스탬프 1개 가져오기
  const { data: lastCheckIn } = await supabase
    .from('stamps')
    .select('checkpoint_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastPoint = lastCheckIn?.checkpoint_id?.toUpperCase();

  // 🏁 순서 검증 로직
  if (point === 'START') {
    // 마지막 지점이 FINISH였거나, 아예 기록이 없을 때만 START 가능
    if (lastPoint && lastPoint !== 'FINISH') {
      return { success: false, message: '이미 랠리가 시작되었습니다. 다음 지점으로 이동하세요!' }
    }
  } 
  else if (point === 'MID') {
    if (lastPoint !== 'START') {
      return { success: false, message: 'START 지점을 먼저 인증해야 합니다!' }
    }
  } 
  else if (point === 'FINISH') {
    if (lastPoint !== 'MID') {
      return { success: false, message: 'MID(정상) 지점을 먼저 인증해야 합니다!' }
    }
    // FINISH인 경우, 완주 처리 대상임을 알림
    return { success: true, message: '완주를 축하합니다!', isFinish: true }
  }

  return { success: true, message: '인증 가능합니다.', isFinish: false }
}