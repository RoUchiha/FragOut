import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getAdMobConfig} from '../mobile/admob.config.cjs';
import {bannerFrameProps} from '../mobile/src/ads/banner-frame.ts';

const androidAppId = 'ca-app-pub-1234567890123456~1234567890';
const androidBannerId = 'ca-app-pub-1234567890123456/0987654321';
const androidEnvironment = {
  FRAGOUT_ADMOB_ANDROID_APP_ID: androidAppId,
  FRAGOUT_ADMOB_ANDROID_BANNER_ID: androidBannerId,
};

test('ads are disabled by default and a platform needs both AdMob IDs', () => {
  assert.deepEqual(getAdMobConfig({}), {android: null, ios: null, testMode: false});
  assert.equal(getAdMobConfig({FRAGOUT_ADMOB_ANDROID_APP_ID: androidAppId}).android, null);
  assert.equal(getAdMobConfig({...androidEnvironment, FRAGOUT_ADMOB_ANDROID_BANNER_ID: androidAppId}).android, null);
  assert.deepEqual(getAdMobConfig(androidEnvironment), {
    android: {appId: androidAppId, bannerId: androidBannerId}, ios: null, testMode: false,
  });
});

test('the Android and iOS banner IDs are independent', () => {
  const appId = 'ca-app-pub-9876543210987654~1234567890';
  const bannerId = 'ca-app-pub-9876543210987654/0123456789';
  const config = getAdMobConfig({FRAGOUT_ADMOB_IOS_APP_ID: ` ${appId} `, FRAGOUT_ADMOB_IOS_BANNER_ID: bannerId});
  assert.equal(config.android, null);
  assert.deepEqual(config.ios, {appId, bannerId});
});

test('test mode uses the Google demo units and cannot enable ads in an EAS production build', () => {
  const environment = {...androidEnvironment, FRAGOUT_ADS_TEST_MODE: 'true'};
  const preview = getAdMobConfig(environment);
  assert.equal(preview.testMode, true);
  assert.equal(preview.android?.bannerId, 'ca-app-pub-3940256099942544/9214589741');
  assert.equal(preview.ios?.bannerId, 'ca-app-pub-3940256099942544/2435281174');
  assert.deepEqual(getAdMobConfig({...environment, EAS_BUILD_PROFILE: 'production'}), {
    android: null, ios: null, testMode: false,
  });
});

test('an empty banner has no layout, touch, or accessibility footprint', () => {
  const hidden = bannerFrameProps(false);
  assert.equal(hidden.style.position, 'absolute');
  assert.equal(hidden.style.height, 0);
  assert.equal(hidden.style.opacity, 0);
  assert.equal(hidden.pointerEvents, 'none');
  assert.equal(hidden.importantForAccessibility, 'no-hide-descendants');
  assert.equal(hidden.accessibilityElementsHidden, true);

  const shown = bannerFrameProps(true);
  assert.equal(shown.style.position, 'relative');
  assert.equal(shown.style.height, undefined);
  assert.equal(shown.pointerEvents, 'box-none');
  assert.equal(shown.accessibilityElementsHidden, false);
});
