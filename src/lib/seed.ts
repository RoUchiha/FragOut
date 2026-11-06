import type { Bottle, Preferences, Shortcut, WearContext } from './types.ts';
export const defaultPreferences:Preferences={likedNotes:[],dislikedNotes:[],excludedIds:[],maxStrength:3,sensitivity:false,units:'F'};
export const defaultContext:WearContext={city:'Your location',tempC:22,humidity:50,setting:'MIXED',indoorTempC:22,occasion:'GENERAL',policy:'FREE',eventAtLocal:'',timezone:'America/Chicago',latitude:41.8,source:'manual'};
export const defaultShortcuts:Shortcut[]=[
  {id:'gym',title:'Gym',icon:'dumbbell',occasion:'GYM',setting:'INDOOR',durationHours:1,maxStrength:1,hidden:false},
  {id:'date',title:'Date night',icon:'heart',occasion:'DATE',setting:'INDOOR',durationHours:3,maxStrength:2,hidden:false},
  {id:'work',title:'Work',icon:'briefcase',occasion:'WORK',setting:'INDOOR',durationHours:8,maxStrength:2,hidden:false},
  {id:'party',title:'Going out',icon:'wine',occasion:'PARTY',setting:'MIXED',durationHours:4,maxStrength:3,hidden:false},
  {id:'errands',title:'Errands',icon:'shopping',occasion:'ERRANDS',setting:'MIXED',durationHours:2,maxStrength:2,hidden:false},
  {id:'weekend',title:'Slow Sunday',icon:'coffee',occasion:'CUSTOM',setting:'MIXED',durationHours:3,maxStrength:2,hidden:false},
  {id:'outdoors',title:'Open air',icon:'sun',occasion:'CUSTOM',setting:'OUTDOOR',durationHours:3,maxStrength:2,hidden:false}
];
const make=(id:string,name:string,family:string,notes:string[],strength:number,climate:Bottle['climate'],color:string,shape:Bottle['shape'],favorite=false):Bottle=>({id,variantId:'demo-'+id,brand:'FRAGOUT ATELIER',name,concentration:'EDP',ownership:'OWNED',family,notes,strength,climate,profileKnown:true,provenance:'demo',color,shape,sizeMl:100,fillPct:75,rating:favorite?5:4,favorite,memo:'Original fictional scent for the demo. Not a real commercial fragrance.'});
export const demoBottles:Bottle[]=[
  make('citrus-current','Citrus Current','Citrus aromatic',['bergamot','neroli','musk'],1,'FRESH','#b8c986','square',true),
  make('still-woods','Still Woods','Woody aromatic',['cedar','vetiver','sage'],2,'BALANCED','#b59268','tall',true),
  make('after-hours','After Hours','Amber spicy',['amber','cardamom','vanilla'],3,'WARM','#815547','square'),
  make('salt-air','Salt Air','Aquatic fresh',['sea salt','sage','driftwood'],1,'FRESH','#b8d0ce','round',true),
  make('soft-suede','Soft Suede','Floral musk',['iris','musk','suede'],1,'BALANCED','#d0b9b9','tall'),
  make('golden-hour','Golden Hour','Woody amber',['sandalwood','amber','fig'],2,'WARM','#c9a95f','round'),
  {...make('midnight-ink','Midnight Ink','Woody leather',['leather','oud','smoke'],3,'WARM','#596373','tall'),ownership:'WISHLIST'},
  {...make('petal-study','Petal Study','Floral',['rose','peony','musk'],2,'BALANCED','#d4b6c2','square'),ownership:'WISHLIST'}
];
export const occasions=[['GENERAL','Everyday'],['GYM','Gym'],['DATE','Date night'],['WORK','Work'],['PARTY','Going out'],['ERRANDS','Errands'],['CUSTOM','Custom occasion']] as const;
