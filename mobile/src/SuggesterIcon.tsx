import React from 'react';
import Svg,{Path} from 'react-native-svg';

export default function SuggesterIcon({color}:{color:string}) {
 return <Svg width={21} height={21} viewBox="0 0 24 24" accessible={false}>
  <Path d="M7 9h9a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Z M9 9V5h5v4 M11 5V3h3 M18 4h3 M19.5 2.5v3 M8 14h7"
   fill="none" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round"/>
 </Svg>;
}
