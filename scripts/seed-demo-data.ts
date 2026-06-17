/**
 * 데모 데이터 시드 — 사이트 활성화된 모습을 위한 풍부한 콘텐츠.
 * 실행: npx tsx scripts/seed-demo-data.ts
 *
 * 환경변수 필요: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// .env.production 수동 파싱 (dotenv 의존 제거)
const envContent = readFileSync('.env.production', 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { db: { schema: 'marie_wedding' } });

// === 업체/인재 프로필 (15개) ===
const PROFILES = [
  { company_name: '그랜드힐 컨벤션', business_type: 'venue',     region: 'seoul',    contact_name: '김지원', bio: '강남 핵심 입지의 프리미엄 웨딩홀. 연 500쌍 진행.', verification_status: 'verified',  premium_tier: 'enterprise', completed_deals_count: 142, response_rate: 95 },
  { company_name: '루나 채플',       business_type: 'venue',     region: 'gyeonggi', contact_name: '박서연', bio: '가든 채플 스타일의 야외 결혼식 전문 예식장.',          verification_status: 'verified',  premium_tier: 'pro',        completed_deals_count: 87,  response_rate: 92 },
  { company_name: '오로르 드레스',   business_type: 'dress',     region: 'seoul',    contact_name: '이수현', bio: '국내외 디자이너 드레스 큐레이션. 압구정 본점.',          verification_status: 'verified',  premium_tier: 'pro',        completed_deals_count: 256, response_rate: 98 },
  { company_name: '비비드 스튜디오', business_type: 'studio',    region: 'seoul',    contact_name: '최진호', bio: '인물 중심의 자연스러운 본식 스냅·앨범.',                verification_status: 'verified',  premium_tier: 'pro',        completed_deals_count: 198, response_rate: 96 },
  { company_name: '아멜리아 메이크업', business_type: 'makeup',  region: 'seoul',    contact_name: '강미래', bio: '신부 맞춤 헤어메이크업. 출장 가능.',                    verification_status: 'verified',  premium_tier: 'basic',      completed_deals_count: 312, response_rate: 99 },
  { company_name: '플랜투게더',     business_type: 'planner',   region: 'seoul',    contact_name: '윤지영', bio: '예산·일정 맞춤 토탈 웨딩 플래닝 12년.',                verification_status: 'verified',  premium_tier: 'pro',        completed_deals_count: 89,  response_rate: 94 },
  { company_name: '서연 플래너',    business_type: 'planner',   region: 'busan',    contact_name: '서지은', bio: '부산·경남 지역 결혼식 진행 도우미.',                    verification_status: 'verified',  premium_tier: 'free',       completed_deals_count: 45,  response_rate: 88 },
  { company_name: '드림팀 어시스턴트', business_type: 'assistant', region: 'gyeonggi', contact_name: '한지민', bio: '결혼식 진행 보조·예식 도우미 인력 풀.',                verification_status: 'verified',  premium_tier: 'basic',      completed_deals_count: 78,  response_rate: 91 },
  { company_name: '준 사회자',      business_type: 'mc',        region: 'seoul',    contact_name: '정상준', bio: '예식 사회 800회 진행. 차분하고 따뜻한 톤.',            verification_status: 'verified',  premium_tier: 'free',       completed_deals_count: 134, response_rate: 97 },
  { company_name: '엘리 디자이너',  business_type: 'designer',  region: 'incheon',  contact_name: '오엘리', bio: '청첩장·답례품·웨딩 굿즈 디자인.',                       verification_status: 'verified',  premium_tier: 'basic',      completed_deals_count: 67,  response_rate: 90 },
  { company_name: '하모니 축가팀',  business_type: 'singer',    region: 'seoul',    contact_name: '김하늘', bio: '클래식·팝 축가 전문. 2-4인 팀.',                       verification_status: 'verified',  premium_tier: 'free',       completed_deals_count: 56,  response_rate: 89 },
  { company_name: '비스포크 채플',  business_type: 'venue',     region: 'daegu',    contact_name: '문태웅', bio: '대구 도심 모던 채플 웨딩홀.',                          verification_status: 'verified',  premium_tier: 'basic',      completed_deals_count: 51,  response_rate: 86 },
  { company_name: '브라이드 메이드', business_type: 'dress',    region: 'gyeonggi', contact_name: '신혜경', bio: '커플별 맞춤 가봉. 신랑 턱시도 동시.',                  verification_status: 'verified',  premium_tier: 'free',       completed_deals_count: 92,  response_rate: 91 },
  { company_name: '루미너스 포토',  business_type: 'studio',    region: 'gwangju',  contact_name: '이도윤', bio: '광주·전남 본식 스냅 + 영상.',                          verification_status: 'unverified', premium_tier: 'free',       completed_deals_count: 18,  response_rate: 82 },
  { company_name: '클래식 사운드',  business_type: 'singer',    region: 'gyeonggi', contact_name: '박서준', bio: '바이올린·피아노 라이브 연주.',                          verification_status: 'verified',  premium_tier: 'free',       completed_deals_count: 41,  response_rate: 90 },
];

// === 공고 (20개) ===
const JOBS = [
  { title: '플래너 정규직 모집 (경력 2년+)',          business_type: 'planner',   employment_type: 'full_time', region: 'seoul',    salary_info: '월 280-400만원' },
  { title: '본식 스냅 작가 (주말 단기)',               business_type: 'studio',    employment_type: 'part_time', region: 'seoul',    salary_info: '회당 35만원' },
  { title: '신부 헤어메이크업 어시스턴트',              business_type: 'makeup',    employment_type: 'contract',  region: 'seoul',    salary_info: '월 250만원' },
  { title: '예식장 상담 매니저',                       business_type: 'venue',     employment_type: 'full_time', region: 'gyeonggi', salary_info: '월 320만원 + 인센티브' },
  { title: '드레스 피팅 보조 (주말)',                  business_type: 'dress',     employment_type: 'part_time', region: 'seoul',    salary_info: '시급 18,000원' },
  { title: '예식 도우미 모집 (현장 진행)',              business_type: 'assistant', employment_type: 'part_time', region: 'seoul',    salary_info: '회당 12만원' },
  { title: '사회자 섭외 (베테랑)',                     business_type: 'mc',        employment_type: 'contract',  region: 'busan',    salary_info: '회당 50만원' },
  { title: '청첩장 디자이너 (재택 가능)',               business_type: 'designer',  employment_type: 'contract',  region: 'incheon',  salary_info: '건당 협의' },
  { title: '축가팀 섭외 (3-4월 주말)',                 business_type: 'singer',    employment_type: 'part_time', region: 'seoul',    salary_info: '팀당 70만원' },
  { title: '웨딩홀 마케팅 매니저',                     business_type: 'venue',     employment_type: 'full_time', region: 'seoul',    salary_info: '월 350-450만원' },
  { title: '신부 메이크업 아티스트 모집',               business_type: 'makeup',    employment_type: 'full_time', region: 'gyeonggi', salary_info: '월 280만원' },
  { title: '본식 영상 촬영 (DV·DSLR)',                business_type: 'studio',    employment_type: 'contract',  region: 'seoul',    salary_info: '회당 45만원' },
  { title: '플래너 신입 모집 (교육)',                  business_type: 'planner',   employment_type: 'full_time', region: 'daegu',    salary_info: '월 230만원' },
  { title: '드레스 디자이너 (3D 패턴)',                business_type: 'dress',     employment_type: 'full_time', region: 'seoul',    salary_info: '월 350만원' },
  { title: '예식장 인테리어 디자이너',                 business_type: 'designer',  employment_type: 'contract',  region: 'gyeonggi', salary_info: '프로젝트 협의' },
  { title: '신부 부케·플라워 어시스턴트',              business_type: 'designer',  employment_type: 'part_time', region: 'seoul',    salary_info: '회당 8만원' },
  { title: '예식장 전속 사회자 (정규)',                business_type: 'mc',        employment_type: 'full_time', region: 'seoul',    salary_info: '월 320만원' },
  { title: '클래식 연주자 (바이올린·피아노)',           business_type: 'singer',    employment_type: 'part_time', region: 'gyeonggi', salary_info: '회당 30만원' },
  { title: '드레스샵 매장 매니저',                     business_type: 'dress',     employment_type: 'full_time', region: 'busan',    salary_info: '월 270만원' },
  { title: '본식 스냅 신입 (교육 가능)',                business_type: 'studio',    employment_type: 'full_time', region: 'gwangju',  salary_info: '월 230만원' },
];

// === 게시글 (15개) ===
const POSTS = [
  { title: '플래너 5년차가 알려주는 견적표 작성 팁',           category: 'tips',  content: '<p>견적표는 단순 가격 리스트가 아니라 신뢰의 시작입니다...</p>' },
  { title: '비수기 예식장 협상 노하우 공유합니다',           category: 'tips',  content: '<p>1-2월 비수기에 받을 수 있는 혜택을 정리했습니다...</p>' },
  { title: '본식 스냅 견적 차이 — 왜 이렇게 큰가요?',        category: 'qna',   content: '<p>스튜디오마다 견적이 2배 차이 나는데, 무엇을 봐야 하나요?</p>' },
  { title: '메이크업 후기 — 아멜리아 메이크업 다녀왔어요',    category: 'review',content: '<p>강남 본점 다녀왔습니다. 신부 메이크업 자연스럽고...</p>' },
  { title: '대구 지역 예식장 추천 받습니다',                 category: 'local', content: '<p>대구 도심권에서 250명 수용 가능한 예식장 찾고 있어요.</p>' },
  { title: '플래너 신입 면접 후기',                          category: 'jobtip',content: '<p>플랜투게더 면접 다녀왔습니다. 기억나는 질문 공유...</p>' },
  { title: '드레스 가봉 횟수, 보통 몇 번이 적정?',          category: 'qna',   content: '<p>3회는 무조건 받아야 한다고 들었는데 정말인가요?</p>' },
  { title: '예식 도우미 시급 최근 동향 정리',                 category: 'tips',  content: '<p>2026년 기준 시급 평균과 지역별 차이...</p>' },
  { title: '청첩장 디자인 트렌드 2026',                      category: 'news',  content: '<p>올해는 미니멀 + 컬러풀이 대세입니다.</p>' },
  { title: '서울 핵심 입지 예식장 후기 모음',                category: 'review',content: '<p>2025년 진행한 3곳 후기 정리해드립니다.</p>' },
  { title: '신부님과 소통하는 법 — 5년차 플래너 노하우',     category: 'tips',  content: '<p>신부님의 진짜 니즈 파악하는 5가지 질문...</p>' },
  { title: '사회자 섭외 시 꼭 확인할 3가지',                 category: 'tips',  content: '<p>예식 30분 전 리허설은 필수입니다.</p>' },
  { title: '부산 예식 도우미 구합니다 (3월)',                 category: 'free',  content: '<p>부산·울산 지역 3월 첫째 주 가능하신 분 문의 부탁드립니다.</p>' },
  { title: '드레스샵 매장 매니저로 일하면서 배운 것',         category: 'jobtip',content: '<p>매장 관리뿐 아니라 신부 응대도 큰 비중입니다.</p>' },
  { title: '웨딩홀 마케팅 — 인스타그램 운영 팁',             category: 'tips',  content: '<p>웨딩홀 SNS는 신부 시각으로 봐야 합니다.</p>' },
];

// === 행사 (8개) ===
const EVENTS = [
  { title: '2026 봄 웨딩 박람회 (코엑스)',  type: 'event',  location: '서울 강남구 코엑스 D홀', start_date: '2026-03-14', end_date: '2026-03-16' },
  { title: '플래너 신입 채용설명회',           type: 'news',   location: '서울 강남구 플랜투게더 본사', start_date: '2026-02-22', end_date: '2026-02-22' },
  { title: '드레스 신상 컬렉션 쇼케이스',      type: 'event',  location: '서울 압구정 오로르 본점', start_date: '2026-04-05', end_date: '2026-04-05' },
  { title: '부산 웨딩 박람회',                type: 'event',  location: '부산 BEXCO',          start_date: '2026-03-28', end_date: '2026-03-29' },
  { title: '웨딩 업계 마케팅 컨퍼런스',        type: 'news',   location: '서울 종로구 KT 아트홀',  start_date: '2026-05-12', end_date: '2026-05-12' },
  { title: '신부 메이크업 트렌드 세미나',     type: 'notice', location: '서울 청담동 아멜리아 본점', start_date: '2026-03-08', end_date: '2026-03-08' },
  { title: '대구 봄 웨딩페어',                 type: 'event',  location: '대구 엑스코',          start_date: '2026-04-19', end_date: '2026-04-20' },
  { title: '사진 작가 워크숍 (광주)',          type: 'notice', location: '광주 김대중 컨벤션센터', start_date: '2026-05-03', end_date: '2026-05-03' },
];

async function main() {
  console.log('🌱 데모 데이터 시드 시작...\n');

  // 1. 데모 사용자 (auth.users + profiles) 생성
  console.log('1) 데모 인재·업체 프로필 15개');
  const profileIds: string[] = [];
  for (const p of PROFILES) {
    const seed = Math.random().toString(36).slice(2, 14);
    const email = `demo-${seed}@example.com`;
    // auth.users
    const { data: userRes, error: authErr } = await sb.auth.admin.createUser({
      email,
      password: 'Demo1234!',
      email_confirm: true,
    });
    if (!userRes?.user) {
      console.log(`  ⚠ ${p.company_name} — auth 실패: ${authErr?.message}`);
      const { data: existing } = await sb.from('profiles').select('id').eq('company_name', p.company_name).is('deleted_at', null).maybeSingle();
      if (existing) profileIds.push(existing.id);
      continue;
    }
    // profile
    const { data: profRes } = await sb.from('profiles').insert({
      user_id: userRes.user.id,
      account_type: 'business',
      company_name: p.company_name,
      contact_name: p.contact_name,
      business_type: p.business_type,
      region: p.region,
      bio: p.bio,
      is_directory_listed: true,
      verification_status: p.verification_status,
      premium_tier: p.premium_tier,
      completed_deals_count: p.completed_deals_count,
      response_rate: p.response_rate,
    }).select('id').single();
    if (profRes) profileIds.push(profRes.id);
    console.log(`  ✓ ${p.company_name}`);
  }
  console.log(`  총 ${profileIds.length}개 생성됨\n`);

  // 2. 공고
  console.log('2) 데모 공고 20개');
  let jobCount = 0;
  for (let i = 0; i < JOBS.length; i++) {
    const job = JOBS[i];
    const authorId = profileIds[i % profileIds.length];
    if (!authorId) continue;
    const { error } = await sb.from('jobs').insert({
      author_id: authorId,
      posting_type: 'hiring',
      title: job.title,
      description: `<p>${job.title}</p><p>좋은 환경에서 함께 일할 분 모십니다.</p>`,
      business_type: job.business_type,
      employment_type: job.employment_type,
      region: job.region,
      salary_info: job.salary_info,
      status: 'open',
      hidden_by_admin: false,
    });
    if (!error) jobCount++;
  }
  console.log(`  ✓ ${jobCount}개 등록\n`);

  // 3. 게시글
  console.log('3) 데모 게시글 15개');
  let postCount = 0;
  for (let i = 0; i < POSTS.length; i++) {
    const post = POSTS[i];
    const authorId = profileIds[i % profileIds.length];
    if (!authorId) continue;
    const { error } = await sb.from('posts').insert({
      author_id: authorId,
      title: post.title,
      content: post.content,
      category: post.category,
      view_count: Math.floor(Math.random() * 800) + 50,
      like_count: Math.floor(Math.random() * 30) + 5,
    });
    if (!error) postCount++;
  }
  console.log(`  ✓ ${postCount}개 등록\n`);

  // 4. 행사
  console.log('4) 데모 행사·박람회 8개');
  let eventCount = 0;
  for (const e of EVENTS) {
    const { error } = await sb.from('events').insert({
      title: e.title,
      type: e.type,
      location: e.location,
      start_date: e.start_date,
      end_date: e.end_date,
      content: `<p>${e.title} — 자세한 안내는 행사 페이지 참고.</p>`,
      is_pinned: e.type === 'event',
    });
    if (!error) eventCount++;
  }
  console.log(`  ✓ ${eventCount}개 등록\n`);

  console.log('🎉 데모 데이터 시드 완료!');
}

main().catch((e) => { console.error(e); process.exit(1); });
