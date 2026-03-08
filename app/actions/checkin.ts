'use server'

import { createClient } from '@/utils/supabase/server'

export async function handleCheckIn(point: 'START' | 'MID' | 'FINISH') {
  const supabase = await createClient()

  // 1. 사용자 인증 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, message: '로그인이 필요합니다.' }

  // 2. 사용자의 가장 최근 체크인 기록 가져오기
  const { data: lastCheckIn } = await supabase
    .from('user_rally_progress')
    .select('point_name')
    .eq('user_id', user.id)
    .order('checked_at', { ascending: false })
    .limit(1)
    .single()

  const lastPoint = lastCheckIn?.point_name

  // 3. 순서 검증 로직
  if (point === 'START') {
    // START는 처음이거나 FINISH 다음에만 가능
    if (lastPoint && lastPoint !== 'FINISH') {
      return { success: false, message: '이미 시작하셨습니다. 다음 목적지로 이동하세요!' }
    }
  } 
  else if (point === 'MID') {
    // MID는 무조건 START 다음에만 가능
    if (lastPoint !== 'START') {
      return { success: false, message: 'START 지점을 먼저 방문해야 합니다!' }
    }
  } 
  else if (point === 'FINISH') {
    // FINISH는 무조건 MID 다음에만 가능
    if (lastPoint !== 'MID') {
      return { success: false, message: 'MID 지점을 먼저 방문해야 합니다!' }
    }
  }

  // 4. 검증 통과 시 데이터 삽입
  const { error: insertError } = await supabase
    .from('user_rally_progress')
    .insert([{ user_id: user.id, point_name: point, checked_at: new Date().toISOString() }])

  if (insertError) return { success: false, message: '오류가 발생했습니다.' }

  return { success: true, message: `${point} 지점 인증 성공!` }
}