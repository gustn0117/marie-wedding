-- ============================================
-- Seed Data for Marié Platform
-- ============================================
-- NOTE: Before running this seed, create test users via Supabase Auth
-- and replace the profile IDs below with actual profile IDs.

-- Sample Profiles (replace user_id with actual auth user IDs)
-- These are example inserts; actual user_id values come from auth.users

/*
INSERT INTO profiles (user_id, business_type, company_name, contact_name, region, bio)
VALUES
  ('AUTH_USER_ID_1', 'venue', '그랜드 웨딩홀', '김미영', 'seoul', '강남 최고의 웨딩 전문 예식장입니다. 20년 전통의 격식있는 예식을 제공합니다.'),
  ('AUTH_USER_ID_2', 'dress', '라벨라 드레스', '이수진', 'seoul', '수입 웨딩드레스 전문샵. 이탈리아, 프랑스 직수입 드레스를 합리적인 가격에 제공합니다.'),
  ('AUTH_USER_ID_3', 'studio', '모먼트 스튜디오', '박준호', 'gyeonggi', '감성적인 웨딩 촬영 전문 스튜디오입니다. 자연광 스튜디오 보유.'),
  ('AUTH_USER_ID_4', 'makeup', '글로우 메이크업', '최은지', 'busan', '신부 메이크업 & 헤어 전문. 부산 지역 1위 웨딩 메이크업샵.'),
  ('AUTH_USER_ID_5', 'planner', '해피엔딩 웨딩', '정다은', 'seoul', '맞춤형 웨딩 플래닝 서비스. 소규모 웨딩부터 대규모 웨딩까지.');
*/

-- After profiles are created, use their IDs for jobs and posts:

/*
-- Sample Jobs
INSERT INTO jobs (author_id, title, description, business_type, employment_type, region, salary_info, is_urgent)
VALUES
  ('PROFILE_ID_1', '웨딩홀 현장 코디네이터 모집', '그랜드 웨딩홀에서 현장 코디네이터를 모집합니다.\n\n[담당업무]\n- 예식 당일 현장 진행 및 관리\n- 신랑신부 및 하객 응대\n- 협력업체 커뮤니케이션\n\n[자격요건]\n- 웨딩 업계 경력 2년 이상\n- 밝고 친절한 성격\n- 주말 근무 가능자', 'venue', 'full_time', 'seoul', '월 280만원~350만원', false),
  ('PROFILE_ID_2', '드레스 피팅 도우미 급구', '주말 드레스 피팅 도우미를 급하게 구합니다.\n\n[업무내용]\n- 신부 드레스 피팅 보조\n- 매장 정리 및 고객 응대\n\n[근무조건]\n- 토/일 10:00~18:00\n- 일당 15만원', 'dress', 'urgent', 'seoul', '일당 15만원', true),
  ('PROFILE_ID_3', '웨딩 촬영 보조 스태프', '모먼트 스튜디오에서 촬영 보조 스태프를 모집합니다.\n\n[업무내용]\n- 촬영 장비 세팅 및 정리\n- 조명 보조\n- 소품 관리\n\n[우대사항]\n- 사진/영상 관련 전공자\n- 포토샵 가능자', 'studio', 'contract', 'gyeonggi', '월 250만원', false),
  ('PROFILE_ID_4', '메이크업 아티스트 채용', '글로우 메이크업에서 메이크업 아티스트를 채용합니다.\n\n[자격요건]\n- 메이크업 자격증 보유\n- 웨딩 메이크업 경력 1년 이상\n- 부산 거주자 우대', 'makeup', 'full_time', 'busan', '월 300만원~400만원 (인센티브 별도)', false),
  ('PROFILE_ID_5', '주말 예식 도우미 모집', '주말 예식 진행 도우미를 모집합니다.\n\n[업무내용]\n- 예식 당일 진행 보조\n- 하객 안내 및 좌석 배치\n- 축의금 관리 보조\n\n[근무시간]\n- 토/일 중 선택 가능\n- 1회 4시간 기준', 'planner', 'part_time', 'seoul', '시급 15,000원', false);

-- Sample Posts
INSERT INTO posts (author_id, title, content, category, view_count)
VALUES
  ('PROFILE_ID_5', '2024 웨딩 트렌드 총정리', '올해 웨딩 업계의 주요 트렌드를 정리해봤습니다.\n\n1. 소규모 프라이빗 웨딩 증가\n2. 아웃도어 웨딩 인기\n3. 지속가능한 웨딩 (친환경 소재, 로컬 플라워)\n4. 테크놀로지 활용 (VR 투어, 온라인 RSVP)\n5. 개인화된 웨딩 경험\n\n업계 종사자분들의 의견도 궁금합니다!', 'news', 156),
  ('PROFILE_ID_3', '웨딩 촬영 조명 노하우 공유', '안녕하세요, 모먼트 스튜디오입니다.\n\n웨딩 촬영 시 자연광을 활용하는 팁을 공유합니다.\n\n1. 골든아워 활용하기 (일몰 1시간 전)\n2. 창가 자연광으로 부드러운 인물 촬영\n3. 반사판 활용법\n4. 역광 촬영 테크닉\n\n질문 있으시면 편하게 댓글 남겨주세요!', 'tips', 89),
  ('PROFILE_ID_1', '예식장 운영하시는 분들 요즘 어떠세요?', '코로나 이후로 예식 트렌드가 많이 변한 것 같아요.\n소규모 예식 문의가 늘어나면서 홀 운영 방식도 바꿔야 할 것 같은데...\n\n다른 예식장 운영자분들은 어떻게 대응하고 계신가요?\n경험 공유 부탁드립니다!', 'free', 234),
  ('PROFILE_ID_2', '드레스샵 고객 응대 팁', '드레스샵을 10년째 운영하면서 느낀 고객 응대 노하우를 공유합니다.\n\n1. 첫 방문 시 충분한 상담 시간 확보\n2. 체형별 추천 드레스 라인 숙지\n3. 동행자(어머니, 친구) 의견 존중하되 신부 의견 우선\n4. 피팅 사진 촬영 서비스 제공\n5. 사후 관리(수선, 클리닝) 안내\n\n도움이 되셨으면 좋겠네요!', 'tips', 167);

-- Sample Comments
INSERT INTO comments (post_id, author_id, content)
VALUES
  ('POST_ID_1', 'PROFILE_ID_3', '좋은 정리 감사합니다! 아웃도어 웨딩 문의가 확실히 늘었어요.'),
  ('POST_ID_1', 'PROFILE_ID_4', '친환경 웨딩 트렌드에 맞춰 비건 메이크업 라인도 준비하고 있습니다.'),
  ('POST_ID_3', 'PROFILE_ID_5', '저도 같은 고민입니다. 소규모 패키지를 새로 만들어서 대응하고 있어요.'),
  ('POST_ID_2', 'PROFILE_ID_1', '반사판 활용법 정말 유용하네요. 예식장 내부 촬영할 때도 참고하겠습니다!');
*/
