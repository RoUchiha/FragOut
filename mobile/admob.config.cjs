const demoPublisher = 'ca-app-pub-3940256099942544';

/** @param {string | undefined} rawAppId @param {string | undefined} rawBannerId */
function publisherIds(rawAppId, rawBannerId) {
  const appId = rawAppId?.trim();
  const bannerId = rawBannerId?.trim();
  if (!appId || !bannerId) return null;

  const publisher = /^(ca-app-pub-\d{16})~\d{10}$/.exec(appId)?.[1];
  const bannerPublisher = /^(ca-app-pub-\d{16})\/\d{10}$/.exec(bannerId)?.[1];
  if (!publisher || publisher === demoPublisher || publisher !== bannerPublisher) return null;

  return {appId, bannerId};
}

/** @param {Record<string, string | undefined>} env */
function getAdMobConfig(env) {
  if (env.FRAGOUT_ADS_TEST_MODE === 'true') {
    if (env.EAS_BUILD_PROFILE === 'production') return {android: null, ios: null, testMode: false};
    return {
      android: {appId: `${demoPublisher}~3347511713`, bannerId: `${demoPublisher}/9214589741`},
      ios: {appId: `${demoPublisher}~1458002511`, bannerId: `${demoPublisher}/2435281174`},
      testMode: true,
    };
  }

  return {
    android: publisherIds(env.FRAGOUT_ADMOB_ANDROID_APP_ID, env.FRAGOUT_ADMOB_ANDROID_BANNER_ID),
    ios: publisherIds(env.FRAGOUT_ADMOB_IOS_APP_ID, env.FRAGOUT_ADMOB_IOS_BANNER_ID),
    testMode: false,
  };
}

exports.getAdMobConfig = getAdMobConfig;
