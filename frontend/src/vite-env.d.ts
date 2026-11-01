/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTROL_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
