import {seasonFor} from './engine.ts';

type Season = ReturnType<typeof seasonFor>;
type DayPart = 'morning' | 'day' | 'evening' | 'night';
type Period = {season:Season; part:DayPart};

interface BaseColors {
 paper:string;
 surface:string;
 ink:string;
 muted:string;
 accent:string;
 accentInk:string;
 link:string;
}

const seasons:Record<Season,{day:BaseColors;night:BaseColors;morning:string;evening:string}> = {
 Spring: {
  day:{paper:'#f2f6ec',surface:'#fcfdf8',ink:'#26352c',muted:'#506055',accent:'#dce9d5',accentInk:'#314c38',link:'#376747'},
  night:{paper:'#171f1b',surface:'#242d27',ink:'#ebf3e7',muted:'#b8c9bb',accent:'#3b5946',accentInk:'#f0f7ed',link:'#b4dcb9'},
  morning:'#faefdf', evening:'#e8def2',
 },
 Summer: {
  day:{paper:'#eff7f6',surface:'#fbfefe',ink:'#173538',muted:'#435e63',accent:'#cbe8e6',accentInk:'#174851',link:'#245d68'},
  night:{paper:'#122327',surface:'#1c3034',ink:'#e4f3f3',muted:'#afd0d1',accent:'#325a61',accentInk:'#e8ffff',link:'#a7dce1'},
  morning:'#faf0d8', evening:'#d8e7f3',
 },
 Autumn: {
  day:{paper:'#f8f3eb',surface:'#fffbf5',ink:'#3a2924',muted:'#655044',accent:'#efdcca',accentInk:'#593a2c',link:'#754a2d'},
  night:{paper:'#211a18',surface:'#2e2420',ink:'#f7eee6',muted:'#d8bfae',accent:'#644735',accentInk:'#fff3e7',link:'#e6b892'},
  morning:'#fff0d3', evening:'#efdbcf',
 },
 Winter: {
  day:{paper:'#f1f5fa',surface:'#fcfdff',ink:'#253447',muted:'#4d5d70',accent:'#dce7f4',accentInk:'#324b68',link:'#365b82'},
  night:{paper:'#171e2d',surface:'#232e40',ink:'#edf3ff',muted:'#c1cce0',accent:'#3e5476',accentInk:'#f0f5ff',link:'#b6cef6'},
  morning:'#f8e9e9', evening:'#dbe1f4',
 },
};

export function themePeriod(date:Date, latitude=0):Period {
 const hour = date.getHours();
 const season = seasonFor(date.getMonth()+1, latitude);
 if (hour < 5 || hour >= 21) return {season,part:'night'};
 if (hour < 9) return {season,part:'morning'};
 if (hour < 17) return {season,part:'day'};
 return {season,part:'evening'};
}

function blend(from:string,to:string,weight:number) {
 const channels = [1,3,5].map(offset => {
  const first = parseInt(from.slice(offset,offset+2),16);
  const second = parseInt(to.slice(offset,offset+2),16);
  return Math.round(first+(second-first)*weight).toString(16).padStart(2,'0');
 });
 return '#'+channels.join('');
}

export function paletteFor({season,part}:Period) {
 const seasonal = seasons[season];
 const isDark = part==='night';
 const base = isDark ? seasonal.night : seasonal.day;
 const tint = part==='morning' || part==='evening' ? seasonal[part] : null;
 const paper = tint ? blend(base.paper,tint,.5) : base.paper;
 const surface = tint ? blend(base.surface,tint,.16) : base.surface;
 const accent = tint ? blend(base.accent,tint,.34) : base.accent;
 return {
  ...base,paper,surface,accent,isDark,
  line:blend(surface,base.ink,isDark ? .20 : .15),
  inputLine:blend(surface,base.ink,isDark ? .46 : .60),
  accentLine:blend(accent,base.accentInk,.33),
  wash:blend(paper,accent,.35),
  warning:isDark?'#392b21':'#fbefe0',
  danger:isDark?'#ffccc4':'#8e3c35',
  dangerSurface:isDark?'#492b2a':'#faebe7',
  scrim:isDark?'rgba(9,12,16,0.68)':'rgba(30,30,25,0.40)',
 };
}

export type Palette = ReturnType<typeof paletteFor>;
