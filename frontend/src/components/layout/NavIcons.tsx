// Hand-drawn line icons, matching LoginPage's LogoMark exactly (stroke
// currentColor, strokeWidth 2, 24x24 viewBox) — this app has no icon font
// and doesn't gain one for three nav links (docs/11-navigation-and-
// distance.md). Kept here, not in constants/navigation.ts: that file is
// plain data with zero React dependency, and an icon is a render concern.
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

export function ApplicationsIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M9 6h11M9 12h11M9 18h11" strokeLinecap="round" />
      <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MetricsIcon(props: IconProps) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path d="M3 20h18" strokeLinecap="round" />
      <path d="M6 20v-7M12 20V6M18 20v-4" strokeLinecap="round" />
    </svg>
  );
}
