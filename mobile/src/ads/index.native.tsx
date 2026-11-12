import Constants from 'expo-constants';
import {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import {AppState, Platform, TurboModuleRegistry, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {AdsConsentInfo} from 'react-native-google-mobile-ads';
import {bannerFrameProps} from './banner-frame';
import type {AdBannerProps, AdsProviderProps} from './index';

type AdsSdk = typeof import('react-native-google-mobile-ads');
type AdsSession = {sdk: AdsSdk; bannerId: string; consent: AdsConsentInfo | null; ready: boolean};
type AdsBuildConfig = {androidBannerId?: string; iosBannerId?: string; testMode: boolean};
type AdDimensions = {width: number; height: number};

const buildConfig = Constants.expoConfig?.extra?.admob as AdsBuildConfig | undefined;
const configuredBannerId = Platform.select({android: buildConfig?.androidBannerId, ios: buildConfig?.iosBannerId});
const AdsContext = createContext<{session: AdsSession; editPrivacy: () => Promise<void>} | null>(null);
const bannerRequest = {requestNonPersonalizedAdsOnly: true};
let startup: Promise<AdsSession | null> | undefined;
let initialization: Promise<boolean> | undefined;

function initializeSdk(sdk: AdsSdk) {
  initialization ??= sdk.default().initialize().then(() => true, () => false);
  return initialization;
}

async function startAds(): Promise<AdsSession | null> {
  // A browser, Expo Go, or a build without IDs can start without the ads module.
  if (typeof configuredBannerId !== 'string' || !configuredBannerId || !TurboModuleRegistry.get('RNGoogleMobileAdsModule')) return null;

  const sdk = await import('react-native-google-mobile-ads');
  const testMode = buildConfig?.testMode === true;
  const consent = testMode ? null : await sdk.AdsConsent.gatherConsent().catch(() => sdk.AdsConsent.getConsentInfo());
  const ready = (testMode || consent?.canRequestAds === true) && await initializeSdk(sdk);
  return {sdk, bannerId: __DEV__ ? sdk.TestIds.ADAPTIVE_BANNER : configuredBannerId, consent, ready};
}

export function AdsProvider({enabled, children}: AdsProviderProps) {
  const [session, setSession] = useState<AdsSession | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    startup ??= startAds().catch(() => null);
    void startup.then(next => {
      if (active) setSession(current => current ?? next);
    });
    return () => { active = false; };
  }, [enabled]);

  async function editPrivacy() {
    if (!session) return;
    try {
      const consent = await session.sdk.AdsConsent.showPrivacyOptionsForm();
      const ready = consent.canRequestAds && await initializeSdk(session.sdk);
      setSession({...session, consent, ready});
    } catch {
      throw new Error('Could not open ad privacy options.');
    }
  }

  return <AdsContext.Provider value={enabled && session ? {session, editPrivacy} : null}>
    {children}
  </AdsContext.Provider>;
}

export function useAdPrivacy() {
  const ads = useContext(AdsContext);
  return ads?.session.consent?.privacyOptionsRequirementStatus === 'REQUIRED' ? ads.editPrivacy : null;
}

export function AdBanner({maxWidth, gutter = 0, maxHeight = 100}: AdBannerProps) {
  const ads = useContext(AdsContext);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const width = Math.floor(Math.min(window.width - insets.left - insets.right, maxWidth ?? window.width) - 2 * gutter);

  if (!ads?.session.ready || width <= 0) return null;
  const {sdk, bannerId} = ads.session;
  return <AdaptiveBanner key={`${bannerId}:${width}:${maxHeight}`} sdk={sdk} bannerId={bannerId} width={width} maxHeight={maxHeight}/>;
}

function AdaptiveBanner({sdk, bannerId, width, maxHeight}: {sdk: AdsSdk; bannerId: string; width: number; maxHeight: number}) {
  const banner = useRef<InstanceType<AdsSdk['BannerAd']>>(null);
  const hasCreative = useRef(false);
  const [visible, setVisible] = useState(false);
  const hide = useCallback(() => {
    hasCreative.current = false;
    setVisible(false);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let backgrounded = AppState.currentState === 'background';
    const listener = AppState.addEventListener('change', state => {
      if (state === 'background') backgrounded = true;
      if (state === 'active' && backgrounded) {
        backgrounded = false;
        hide();
        banner.current?.load();
      }
    });
    return () => listener.remove();
  }, [hide]);

  function showWhenSized({width, height}: AdDimensions) {
    if (hasCreative.current) setVisible(width > 0 && height > 0);
  }

  return <View {...bannerFrameProps(visible)} testID={visible ? 'admob-banner' : undefined}>
    <sdk.BannerAd
      ref={banner}
      unitId={bannerId}
      size={sdk.BannerAdSize.INLINE_ADAPTIVE_BANNER}
      width={width}
      maxHeight={maxHeight}
      requestOptions={bannerRequest}
      onAdLoaded={dimensions => {
        hasCreative.current = true;
        showWhenSized(dimensions);
      }}
      onSizeChange={showWhenSized}
      onAdFailedToLoad={hide}
    />
  </View>;
}
