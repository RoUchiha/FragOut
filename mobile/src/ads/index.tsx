import type {ReactNode} from 'react';

export type AdsProviderProps = {enabled: boolean; children: ReactNode};
export type AdBannerProps = {maxWidth?: number; gutter?: number; maxHeight?: number};

export function AdsProvider({children}: AdsProviderProps) {
  return children;
}

export function AdBanner(_props: AdBannerProps) {
  return null;
}

export function useAdPrivacy(): (() => Promise<void>) | null {
  return null;
}
