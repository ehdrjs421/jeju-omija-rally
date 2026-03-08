import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 함수 자체를 async로 만들어서 내부에서 await cookies()를 사용합니다.
export async function createClient() {
  const cookieStore = await cookies() // 여기서 await가 필수입니다!

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 서버 액션 내부에서 호출될 때의 예외 처리
          }
        },
      },
    }
  )
}