import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const IconSearch: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
  </svg>
);

export const IconShield: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M5.338 1.59a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.7 10.7 0 0 0 2.287 2.233c.346.244.652.42.893.533q.18.085.293.118a1 1 0 0 0 .101.025 1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56" />
    <path d="M10.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0" />
  </svg>
);

export const IconCheck: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0" />
  </svg>
);

export const IconBolt: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641z" />
  </svg>
);

export const IconSparkle: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M7.5 1.5a.5.5 0 0 1 1 0v2.5a.5.5 0 0 1-1 0zm0 10.5a.5.5 0 0 1 1 0v2.5a.5.5 0 0 1-1 0zm-5-5a.5.5 0 0 1 0-1h2.5a.5.5 0 0 1 0 1zm10.5 0a.5.5 0 0 1 0-1h2.5a.5.5 0 0 1 0 1zM3.854 4.56a.5.5 0 0 1 .708-.707l1.767 1.767a.5.5 0 0 1-.707.708zm6.728 6.728a.5.5 0 0 1 .707-.707l1.768 1.767a.5.5 0 0 1-.708.708zm1.768-6.728a.5.5 0 0 1-.708-.707l-1.768 1.767a.5.5 0 1 1 .708.708zm-6.728 6.728a.5.5 0 0 1-.707-.707L3.146 11.28a.5.5 0 1 1 .708.708z" />
  </svg>
);

export const IconFileText: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2zM4.5 8a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1zm0 2.5a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1zm0 2.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1z" />
  </svg>
);

export const IconSidebar: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M0 3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm5-1v12h9a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1zM4 2H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h2z" />
  </svg>
);

export const IconUpload: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5" />
    <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V10.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708z" />
  </svg>
);

export const IconCloud: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.57A4.5 4.5 0 0 1 15.5 11 4.5 4.5 0 0 1 11 15.5H4a4 4 0 0 1-4-4c0-1.846 1.25-3.393 2.956-3.837a5.5 5.5 0 0 1 1.45-4.321" />
  </svg>
);

export const IconLaptop: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M13.5 3a.5.5 0 0 1 .5.5V11H2V3.5a.5.5 0 0 1 .5-.5zm-11-1A1.5 1.5 0 0 0 1 3.5V12h14V3.5A1.5 1.5 0 0 0 13.5 2zM0 12.5h16a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5" />
  </svg>
);

export const IconServer: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M1.5 0A1.5 1.5 0 0 0 0 1.5v2A1.5 1.5 0 0 0 1.5 5h13A1.5 1.5 0 0 0 16 3.5v-2A1.5 1.5 0 0 0 14.5 0zm1 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1m2 0a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1M1.5 5.5A1.5 1.5 0 0 0 0 7v2a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 16 9V7a1.5 1.5 0 0 0-1.5-1.5zm1 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1m2 0a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1M1.5 11A1.5 1.5 0 0 0 0 12.5v2A1.5 1.5 0 0 0 1.5 16h13a1.5 1.5 0 0 0 1.5-1.5v-2A1.5 1.5 0 0 0 14.5 11zm1 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1m2 0a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1" />
  </svg>
);

export const IconGitHub: React.FC<IconProps> = ({ size = 16, className = "", style }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} style={style} aria-hidden="true">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
  </svg>
);

export const IconBrandLogo: React.FC<{ size?: number; className?: string }> = ({ size = 28, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#285430" />
        <stop offset="100%" stopColor="#1e3f24" />
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="8" fill="url(#logoBg)" />
    {/* Cloud body */}
    <path
      d="M9.5 18.5a3.5 3.5 0 0 1 3.2-3.46A4.5 4.5 0 0 1 21.2 14a3.3 3.3 0 0 1 3.3 3.3c0 1.82-1.48 3.2-3.3 3.2H11a3.5 3.5 0 0 1-1.5-.34"
      stroke="#ffffff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Downward routing arrow with autumn gold accent */}
    <path d="M16 14.5v7M13.5 19l2.5 2.5 2.5-2.5" stroke="#fcd34d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
