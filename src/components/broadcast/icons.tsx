import type { SVGProps } from 'react';

// Hand-drawn to sit on the 14 degree slant. Decorative: the buttons that use them carry the name.
const Icon = ({ children, ...props }: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const PlayIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M6 2h5l11 10-14 10H4z" />
  </Icon>
);

export const PauseIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M7 3h5L9 21H4zM17 3h5l-3 18h-5z" />
  </Icon>
);

export const NextIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3 4l11 8-11 8zM17 4h4l-1 16h-4z" />
  </Icon>
);

export const PrevIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M21 4v16L10 12zM4 4h4l-1 16H3z" />
  </Icon>
);

export const CameraIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3 6h13l-1 12H2zM17 10l5-3-1 10-5-3z" />
  </Icon>
);

export const MicIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M10 2h5l-1 11H9zM5 11h2.500c0 3 2 4 4.500 4s5-1 5-4h2.500c0 4-3 6-6.500 6.500V21h3v2H7v-2h3v-3.500C6.500 17 5 15 5 11z" />
  </Icon>
);

export const StopIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M7 4h15l-3 16H4z" />
  </Icon>
);
