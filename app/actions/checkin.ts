'use server'

// app/actions/checkin.ts 기준에서 utils는 두 단계 위(../../)에 있습니다.
import { createClient } from '../../utils/supabase/server'; 

export async function handleCheckIn(point: 'START' | 'MID' | 'FINISH', userId: string, userName?: string) {
  // 에러가 나면 여기서 멈추므로 반드시 위 import가 성공해야 합니다.
  console.log("🔥🔥🔥 [SERVER ACTION EXECUTED] 🔥🔥🔥");
  console.log("파라미터 확인:", { point, userId, userName });
  const supabase = await createClient(); 

  if (!userId) return { success: false, message: '유저 정보가 없습니다.' };

  try {
    // 1단계: 유저 확인 및 등록 (수동 등록 전까지 에러 방지용)
    await supabase.from('users').upsert({
      id: userId,
      name: userName || '참가자',
      bib_number: `BIB-${userId.slice(0, 8)}`
    }, { onConflict: 'id' });

    // 2단계: 마지막 기록 조회
    const { data: lastStamp } = await supabase
      .from('stamps')
      .select('checkpoint_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastPoint = lastStamp?.checkpoint_id?.toUpperCase();
    const currentPoint = point.toUpperCase();

    // 3단계: 순서 검증 (START -> MID -> FINISH)
    if (currentPoint === 'MID' && lastPoint !== 'START') {
      return { success: false, message: '출발(START)을 먼저 스캔하세요.' };
    }
    if (currentPoint === 'FINISH' && lastPoint !== 'MID') {
      return { success: false, message: '정상(MID)을 먼저 스캔하세요.' };
    }

    // 4단계: 스탬프 찍기
    const { error: stampError } = await supabase.from('stamps').insert({
      user_id: userId,
      checkpoint_id: currentPoint
    });

    if (stampError) {
      // ⚠️ Cloudflare 로그뿐만 아니라, 클라이언트에게도 상세 에러를 보냅니다.
      console.error("❌ DB 저장 실패:", stampError.message);
      return { 
        success: false, 
        message: `DB 저장 실패: ${stampError.message} (${stampError.details || '상세없음'})` 
      };
    }
    // if (sErr) throw sErr;

    // 5단계: 완주 처리
    let isFinish = false;
    if (currentPoint === 'FINISH') {
      await supabase.from('laps').insert({ user_id: userId });
      isFinish = true;
    }

    return { success: true, message: isFinish ? "완주 성공!" : `${currentPoint} 인증!`, isFinish };

  } catch (err: any) {
    console.error("인증 처리 실패:", err.message);
    return { success: false, message: "연결 오류가 발생했습니다." };
  }
}