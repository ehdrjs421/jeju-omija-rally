/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloudflare Pages는 정적 최적화와 Edge Functions를 지원합니다.
  // 특별한 설정 없이도 기본적으로 잘 작동하지만, 
  // 만약 빌드 에러가 난다면 output: 'export'를 고려할 수 있습니다.
  // (단, 우리 앱은 서버 기능이 필요하므로 기본 설정을 유지합니다.)
};

export default nextConfig;