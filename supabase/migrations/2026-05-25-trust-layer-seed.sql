-- review_tags 초기 시드
-- 적용: 2026-05-25-trust-layer.sql 적용 후 실행

INSERT INTO marie_wedding.review_tags (label, category, applies_to, display_order) VALUES
  ('시간 약속을 잘 지킴', 'positive', ARRAY['hiring','applicant'], 10),
  ('소통이 원활함', 'positive', ARRAY['hiring','applicant'], 20),
  ('사전 협의와 실제가 일치함', 'positive', ARRAY['hiring','applicant'], 30),
  ('현장 대응력이 좋음', 'positive', ARRAY['hiring','applicant'], 40),
  ('결제·정산이 깔끔함', 'positive', ARRAY['hiring'], 50),
  ('포트폴리오와 실물이 일치함', 'positive', ARRAY['applicant'], 60),
  ('응답이 늦음', 'attention', ARRAY['hiring','applicant'], 100),
  ('사전 협의와 실제가 불일치함', 'attention', ARRAY['hiring','applicant'], 110),
  ('일방적인 변경·취소', 'attention', ARRAY['hiring','applicant'], 120)
ON CONFLICT (label) DO NOTHING;
