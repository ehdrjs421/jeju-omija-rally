// app/actions/checkin.ts
'use server'

import { createClient } from '@/utils/supabase/server'

// userId를 인자로 받도록 수정합니다.
export async function handleCheckIn(point: 'START' | 'MID' | 'FINISH', userId: string) {
  const supabase = await createClient()

  // 1. 유저 ID가 없으면 차단
  if (!userId) return { success: false, message: '유저 정보가 유효하지 않습니다.' }

  // 2. 해당 유저의 가장 최신 스탬프 기록 가져오기
  const { data: lastCheckIn } = await supabase
    .from('stamps')
    .select('checkpoint_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastPoint = lastCheckIn?.checkpoint_id?.toUpperCase();

  // 3. 순서 검증 로직 (기존과 동일)
  if (point === 'START') {
    if (lastPoint && lastPoint !== 'FINISH') {
      return { success: false, message: '이미 랠리를 진행 중입니다.' }
    }
  } 
  else if (point === 'MID') {
    if (lastPoint !== 'START') {
      return { success: false, message: 'START 지점을 먼저 인증해야 합니다!' }
    }
  } 
  else if (point === 'FINISH') {
    if (lastPoint !== 'MID') {
      return { success: false, message: 'MID 지점을 먼저 인증해야 합니다!' }
    }
  }

  return { success: true, message: '인증 가능합니다.' }
}