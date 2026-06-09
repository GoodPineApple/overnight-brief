-- users 테이블에 password_hash 컬럼 추가 (JWT 자체 인증용)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 기존 Supabase Auth 의존성 제거 후 email+password 인증으로 전환
-- password_hash는 bcrypt로 해싱된 값이 저장됨
