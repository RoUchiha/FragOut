import type {ExpoConfig} from 'expo/config';
import {getAdMobConfig} from './admob.config.cjs';

const dictationPermission='Dictate your outfit description.';
const iosBundleId='app.fragout.mobile';
const simulatorAcceptance=process.env.FRAGOUT_IOS_SIMULATOR_ACCEPTANCE==='1';
const ads=getAdMobConfig(process.env);
const adPlugins:NonNullable<ExpoConfig['plugins']>=ads.android||ads.ios ? [
 ['react-native-google-mobile-ads',{
  androidAppId:ads.android?.appId,
  iosAppId:ads.ios?.appId,
  delayAppMeasurementInit:true,
 }],
] : [];
const config:ExpoConfig={
 name:'FragOut',slug:'fragout-mobile',version:'0.2.0',scheme:'fragout',orientation:'portrait',icon:'./assets/icon.png',
 ios:{supportsTablet:true,bundleIdentifier:iosBundleId,userInterfaceStyle:'light',
  // Xcode embeds this identity in the simulator executable for SecureStore.
  ...(simulatorAcceptance?{entitlements:{'application-identifier':`SIMULATOR0.${iosBundleId}`}}:{}),
  infoPlist:{UIFileSharingEnabled:false,LSSupportsOpeningDocumentsInPlace:false,
   NSAppTransportSecurity:{NSAllowsArbitraryLoads:false,NSAllowsLocalNetworking:true}}},
 android:{package:'app.fragout.mobile',allowBackup:false,adaptiveIcon:{foregroundImage:'./assets/icon.png',backgroundColor:'#f8f8f5'},
  ...(ads.android?{blockedPermissions:['com.google.android.gms.permission.AD_ID']}:{}),
 },
 web:{bundler:'metro',output:'single',favicon:'./assets/favicon.png'},
 plugins:[
  'expo-router',
  ['expo-image-picker',{photosPermission:'Choose an outfit or fragrance photo.',
   cameraPermission:'Take outfit selfies and fragrance bottle photos.',microphonePermission:dictationPermission}],
  ['expo-speech-recognition',{microphonePermission:dictationPermission,speechRecognitionPermission:'Turn your outfit description into text.'}],
  'expo-secure-store','expo-sharing','expo-status-bar','expo-web-browser',
  ...adPlugins,
 ],
 extra:{admob:{
  ...(ads.android?{androidBannerId:ads.android.bannerId}:{}),
  ...(ads.ios?{iosBannerId:ads.ios.bannerId}:{}),
  testMode:ads.testMode,
 }},
 experiments:{baseUrl:'/mobile'}
};
export default config;
