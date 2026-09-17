-- ============================================================
-- DompetBareng: Remote Config Table for AI & System Settings
-- Memungkinkan perubahan URL tunnel / model AI tanpa rebuild APK / OTA
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_configs (
    key text PRIMARY KEY,
    value text NOT NULL,
    description text,
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_configs ENABLE ROW LEVEL SECURITY;

-- Siapapun (anon & authenticated) bisa membaca config
DROP POLICY IF EXISTS "Allow read for all users" ON public.app_configs;
CREATE POLICY "Allow read for all users"
    ON public.app_configs
    FOR SELECT
    USING (true);

-- Insert initial values
INSERT INTO public.app_configs (key, value, description)
VALUES 
    ('ai_base_url', 'https://rb4hc5v.abc-tunnel.us/v1', 'Base URL untuk AI proxy / 9Router tunnel'),
    ('ai_model', 'ag/gemini-3.8-flash-high', 'Model name untuk AI')
ON CONFLICT (key) DO NOTHING;

-- Aktifkan realtime agar app langsung terima perubahan URL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'app_configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_configs;
  END IF;
END $$;
