'use server'
// app/actions/checkin.ts (수동 유저 관리용)
import { createClient } from '../../utils/supabase/server'

export async function handleCheckIn(point: 'START' | 'MID' | 'FINISH', userId: string,userName?: string) {
  const supabase = await createClient();

  // 1. 유저 존재 여부 확인 없이 바로 인증 로직 진행
  const { data: lastCheckIn } = await supabase
    .from('stamps')
    .select('checkpoint_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastPoint = lastCheckIn?.checkpoint_id?.toUpperCase();
  const currentPoint = point.toUpperCase();

  // 2. 순서 검증
  if (currentPoint === 'MID' && lastPoint !== 'START') return { success: false, message: 'START를 먼저 찍으세요.' };
  if (currentPoint === 'FINISH' && lastPoint !== 'MID') return { success: false, message: 'MID를 먼저 찍으세요.' };

  // 3. 기록 (여기서 Foreign Key 에러가 날 수 있으니, stamps의 FK를 해제한 상태여야 함)
  const { error: stampError } = await supabase.from('stamps').insert({
    user_id: userId,
    checkpoint_id: currentPoint
  });

  if (stampError) return { success: false, message: "기록 실패: DB에 유저가 등록되어 있는지 확인하세요." };

  // 4. 완주 기록
  if (currentPoint === 'FINISH') {
    await supabase.from('laps').insert({ user_id: userId });
    return { success: true, message: '완주 성공!', isFinish: true };
  }

  return { success: true, message: `${currentPoint} 인증 완료!`, isFinish: false };
}