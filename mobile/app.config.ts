import type {ExpoConfig} from 'expo/config';
const config:ExpoConfig={
 name:'FragOut',slug:'fragout-mobile',version:'0.2.0',scheme:'fragout',orientation:'portrait',userInterfaceStyle:'light',icon:'./assets/icon.png',
 ios:{supportsTablet:true,bundleIdentifier:'app.fragout.mobile'},
 android:{package:'app.fragout.mobile',adaptiveIcon:{foregroundImage:'./assets/icon.png',backgroundColor:'#f8f8f5'}},
 web:{bundler:'metro',output:'single',favicon:'./assets/favicon.png'},
 plugins:['expo-router',['expo-image-picker',{photosPermission:'Choose an outfit or fragrance photo.',cameraPermission:'Take outfit selfies and fragrance bottle photos.',microphonePermission:false}],['expo-speech-recognition',{microphonePermission:'Dictate your outfit description.',speechRecognitionPermission:'Turn your outfit description into text.'}],'expo-secure-store','expo-sharing'],
 experiments:{baseUrl:'/mobile'}
};
export default config;
