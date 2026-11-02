import React from "react";

interface IconProps {
  size?: number;
  className?: string;
}

export const IconSearch: React.FC<IconProps> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
  </svg>
);

export const IconShield: React.FC<IconProps> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
    <path d="M5.338 1.59a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.7 10.7 0 0 0 2.287 2.233c.346.244.652.42.893.533q.18.085.293.118a1 1 0 0 0 .101.025 1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56" />
    <path d="M10.854 5.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 7.793l2.646-2.647a.5.5 0 0 1 .708 0" />
  </svg>
);

export const IconCheck: React.FC<IconProps> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
    <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0" />
  </svg>
);

export const IconBolt: React.FC<IconProps> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
    <path d="M5.52.359A.5.5 0 0 1 6 0h4a.5.5 0 0 1 .474.658L8.694 6H12.5a.5.5 0 0 1 .395.807l-7 9a.5.5 0 0 1-.873-.454L6.823 9.5H3.5a.5.5 0 0 1-.48-.641z" />
  </svg>
);

export const IconSparkle: React.FC<IconProps> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
    <path d="M7.5 1.5a.5.5 0 0 1 1 0v2.5a.5.5 0 0 1-1 0zm0 10.5a.5.5 0 0 1 1 0v2.5a.5.5 0 0 1-1 0zm-5-5a.5.5 0 0 1 0-1h2.5a.5.5 0 0 1 0 1zm10.5 0a.5.5 0 0 1 0-1h2.5a.5.5 0 0 1 0 1zM3.854 4.56a.5.5 0 0 1 .708-.707l1.767 1.767a.5.5 0 0 1-.707.708zm6.728 6.728a.5.5 0 0 1 .707-.707l1.768 1.767a.5.5 0 0 1-.708.708zm1.768-6.728a.5.5 0 0 1-.708-.707l-1.768 1.767a.5.5 0 1 1 .708.708zm-6.728 6.728a.5.5 0 0 1-.707-.707L3.146 11.28a.5.5 0 1 1 .708.708z" />
  </svg>
);

export const IconFileText: React.FC<IconProps> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
    <path d="M4 0h5.293A1 1 0 0 1 10 .293L13.707 4a1 1 0 0 1 .293.707V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2m5.5 1.5v2a1 1 0 0 0 1 1h2zM4.5 8a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1zm0 2.5a.5.5 0 0 0 0 1h7a.5.5 0 0 0 0-1zm0 2.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1z" />
  </svg>
);

export const IconCloud: React.FC<IconProps> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
    <path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.57A4.5 4.5 0 0 1 15.5 11 4.5 4.5 0 0 1 11 15.5H4a4 4 0 0 1-4-4c0-1.846 1.25-3.393 2.956-3.837a5.5 5.5 0 0 1 1.45-4.321" />
  </svg>
);

export const IconLaptop: React.FC<IconProps> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
    <path d="M13.5 3a.5.5 0 0 1 .5.5V11H2V3.5a.5.5 0 0 1 .5-.5zm-11-1A1.5 1.5 0 0 0 1 3.5V12h14V3.5A1.5 1.5 0 0 0 13.5 2zM0 12.5h16a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5" />
  </svg>
);

export const IconServer: React.FC<IconProps> = ({ size = 16, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
    <path d="M1.5 0A1.5 1.5 0 0 0 0 1.5v2A1.5 1.5 0 0 0 1.5 5h13A1.5 1.5 0 0 0 16 3.5v-2A1.5 1.5 0 0 0 14.5 0zm1 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1m2 0a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1M1.5 5.5A1.5 1.5 0 0 0 0 7v2a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 16 9V7a1.5 1.5 0 0 0-1.5-1.5zm1 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1m2 0a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1M1.5 11A1.5 1.5 0 0 0 0 12.5v2A1.5 1.5 0 0 0 1.5 16h13a1.5 1.5 0 0 0 1.5-1.5v-2A1.5 1.5 0 0 0 14.5 11zm1 2a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1m2 0a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1" />
  </svg>
);

export const IconLogo: React.FC<IconProps> = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
