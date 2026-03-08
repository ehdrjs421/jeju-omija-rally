'use server'

import { createClient } from '@/utils/supabase/server'

export async function handleCheckIn(point: 'START' | 'MID' | 'FINISH', userId: string) {
  const supabase = await createClient()

  if (!userId) return { success: false, message: '유저 정보가 유효하지 않습니다.' }

  // 1. 마지막 스탬프 조회
  const { data: lastCheckIn } = await supabase
    .from('stamps')
    .select('checkpoint_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastPoint = lastCheckIn?.checkpoint_id?.toUpperCase();
  const currentPoint = point.toUpperCase(); // 대소문자 방지

  // 2. 단계별 검증
  if (currentPoint === 'START') {
    // 이미 시작했더라도 다시 START를 찍는 것은 허용 (재시작 개념)
    return { success: true, message: '출발!', isFinish: false }
  } 
  
  if (currentPoint === 'MID') {
    if (lastPoint !== 'START') {
      return { success: false, message: 'START 지점을 먼저 인증해야 합니다.' }
    }
    return { success: true, message: '정상 통과!', isFinish: false }
  } 
  
  if (currentPoint === 'FINISH') {
    if (lastPoint !== 'MID') {
      return { success: false, message: 'MID(정상) 지점을 먼저 인증해야 합니다.' }
    }
    // 🔥 FINISH 일 때만 true 반환
    return { success: true, message: '완주 성공!', isFinish: true }
  }

  return { success: false, message: '잘못된 지점 데이터입니다.' }
}