-- Supabase SQL 에디터에서 테이블을 직접 생성하면 service_role 권한이 누락될 수 있음.
-- PostgREST(service_role)가 public 스키마 테이블에 접근할 수 있도록 권한 부여.

-- Google OAuth provider_id 조회 성능
CREATE INDEX IF NOT EXISTS idx_users_provider_id ON users(provider, provider_id);

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, service_role;
