/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_AI_REFLECTION?: string; // "on" shows the temporary hackathon AI reflection
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
