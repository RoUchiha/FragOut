import assert from 'node:assert/strict';
import {test} from 'node:test';
import {paletteFor, themePeriod} from '../src/lib/palette.ts';

test('palette follows local clock boundaries and flips seasons across the equator', () => {
 const periods = [4,5,8,9,16,17,20,21].map(hour => themePeriod(new Date(2026,10,7,hour),41));
 assert.deepEqual(periods.map(period => period.part), ['night','morning','morning','day','day','evening','evening','night']);
 assert.equal(periods[0].season,'Autumn');
 assert.equal(themePeriod(new Date(2026,10,7,12),-33).season,'Spring');
 assert.equal(themePeriod(new Date(2026,11,1,12),0).season,'Winter');
});

const luminance = (hex:string) => [1,3,5].map(offset => {
 const channel = parseInt(hex.slice(offset, offset+2),16)/255;
 return channel <= 0.04045 ? channel/12.92 : ((channel+0.055)/1.055)**2.4;
}).reduce((sum, channel, index) => sum+channel*[0.2126,0.7152,0.0722][index],0);
const contrast = (a:string,b:string) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);

test('all seasonal and time palettes are distinct with readable text and controls', () => {
 const papers = new Set<string>();
 for (const month of [0,3,6,9]) for (const hour of [7,12,18,22]) {
  const period = themePeriod(new Date(2026,month,7,hour),41);
  const colors = paletteFor(period);
  papers.add(colors.paper);
  const pairs = [[colors.ink,colors.paper],[colors.muted,colors.paper],[colors.muted,colors.surface],[colors.muted,colors.wash],[colors.muted,colors.warning],[colors.accentInk,colors.accent],[colors.link,colors.surface],[colors.danger,colors.dangerSurface]];
  for (const [text,background] of pairs) assert.ok(contrast(text,background)>=4.5,`${period.season} ${period.part} ${text} on ${background}`);
  assert.ok(contrast(colors.inputLine,colors.surface)>=3,`${period.season} ${period.part} search outline`);
  assert.ok(contrast(colors.inputLine,colors.paper)>=3,`${period.season} ${period.part} input boundary`);
  assert.equal(colors.isDark,hour===22);
 }
 assert.equal(papers.size,16);
});
