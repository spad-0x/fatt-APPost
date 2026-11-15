import type { CSSProperties } from 'react';

type BrandLogoProps = {
  background?: 'light' | 'dark';
  width?: number;
  className?: string;
  decorative?: boolean;
  basePath?: string;
  style?: CSSProperties;
};

/** Copy the kit's public/ files into the application's public/ directory. */
export function BrandLogo({
  background = 'light',
  width = 280,
  className,
  decorative = false,
  basePath = '',
  style,
}: BrandLogoProps) {
  const variant = background === 'dark' ? 'reverse' : 'on-light';
  const root = basePath.replace(/\/$/, '');
  return (
    <img
      src={`${root}/brand/logo-horizontal-${variant}.svg`}
      width={width}
      height={width / 4}
      alt={decorative ? '' : 'fatt APPost'}
      className={className}
      style={{ display: 'block', maxWidth: '100%', height: 'auto', ...style }}
    />
  );
}
