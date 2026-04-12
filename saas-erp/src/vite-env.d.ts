/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GEMINI_API_KEY?: AIzaSyCSznW6t8nzddOuQdvNkkGybqw3xOSGUnE;
  readonly GEMINI_API_KEY?: AIzaSyCSznW6t8nzddOuQdvNkkGybqw3xOSGUnE;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
