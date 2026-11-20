interface IconProps {
  size?: number;
  strokeWidth?: number;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export function IconSun({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5" />
    </svg>
  );
}

export function IconMoon({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.7 8.7 0 1 0 11 11Z" />
    </svg>
  );
}

export function IconPhoto({ size = 20, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.6" />
      <circle cx="8.6" cy="9.8" r="1.7" />
      <path d="m3.4 16.6 4.9-4.6a2 2 0 0 1 2.7 0l3.5 3.3M14 14.2l1.9-1.8a2 2 0 0 1 2.7 0l2 1.9" />
    </svg>
  );
}

export function IconVideo({ size = 20, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <rect x="2.6" y="6" width="13.2" height="12" rx="2.4" />
      <path d="m15.8 10.4 4.4-2.6a.8.8 0 0 1 1.2.7v7a.8.8 0 0 1-1.2.7l-4.4-2.6" />
    </svg>
  );
}

export function IconCamera({ size = 20, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M3.4 8.6h2.9l1.3-2.1h6.8l1.3 2.1h2.9a1.6 1.6 0 0 1 1.6 1.6v7.4a1.6 1.6 0 0 1-1.6 1.6H3.4a1.6 1.6 0 0 1-1.6-1.6v-7.4a1.6 1.6 0 0 1 1.6-1.6Z" />
      <circle cx="12" cy="13.6" r="3.3" />
    </svg>
  );
}

export function IconFlip({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M4 8.5a8 8 0 0 1 13.2-2.7L20 8.4M20 4.6v3.8h-3.8M20 15.5a8 8 0 0 1-13.2 2.7L4 15.6M4 19.4v-3.8h3.8" />
    </svg>
  );
}

export function IconPlay({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" stroke="none">
      <path d="M8 5.4v13.2a.6.6 0 0 0 .92.5l10.2-6.6a.6.6 0 0 0 0-1L8.92 4.9A.6.6 0 0 0 8 5.4Z" />
    </svg>
  );
}

export function IconPause({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" stroke="none">
      <rect x="6.6" y="5" width="3.8" height="14" rx="1.2" />
      <rect x="13.6" y="5" width="3.8" height="14" rx="1.2" />
    </svg>
  );
}

export function IconDownload({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M12 3.8v10.4M8.2 10.6 12 14.4l3.8-3.8M4.4 16.6v2.2a1.4 1.4 0 0 0 1.4 1.4h12.4a1.4 1.4 0 0 0 1.4-1.4v-2.2" />
    </svg>
  );
}

export function IconCopy({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.2" />
      <path d="M15.4 5.6a2 2 0 0 0-2-2H6a2.2 2.2 0 0 0-2.2 2.2v7.4a2 2 0 0 0 2 2" />
    </svg>
  );
}

export function IconClose({ size = 18, strokeWidth = 1.9 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6" />
    </svg>
  );
}

export function IconReset({ size = 18, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M3.8 12a8.2 8.2 0 1 0 2.6-6l-2.4 2.4" />
      <path d="M4 4.6v4.2h4.2" />
    </svg>
  );
}

export function IconTarget({ size = 24, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3" />
      <path d="M3.4 8.6h4.2V3.4M20.6 8.6h-4.2V3.4M3.4 15.4h4.2v5.2M20.6 15.4h-4.2v5.2" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function IconEye({ size = 16, strokeWidth = 1.8 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <path d="M2.4 12s3.4-6.2 9.6-6.2S21.6 12 21.6 12s-3.4 6.2-9.6 6.2S2.4 12 2.4 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  );
}

export function IconMosaic({ size = 16, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg {...base(size)} strokeWidth={strokeWidth}>
      <rect x="3.4" y="3.4" width="7" height="7" rx="1.2" />
      <rect x="13.6" y="3.4" width="7" height="7" rx="1.2" />
      <rect x="3.4" y="13.6" width="7" height="7" rx="1.2" />
      <rect x="13.6" y="13.6" width="7" height="7" rx="1.2" />
    </svg>
  );
}
