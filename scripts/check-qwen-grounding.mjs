import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import sharp from 'sharp';
import {findCatalogProfile} from '../src/lib/catalog.ts';
import {parseOutfitText} from '../src/lib/outfit.ts';
import {LOCAL_MODEL,localModelStatus,prepareImage,runVision} from '../src/lib/providers.ts';

const status = await localModelStatus();
assert.ok(status.installed, `Start Ollama with ${LOCAL_MODEL} before running the grounding check.`);
console.log(`Grounding checks using ${LOCAL_MODEL}`);

const read = path => readFile(new URL('../'+path,import.meta.url));
const png = svg => sharp(Buffer.from(svg)).png().toBuffer();
const blank = await sharp({create:{width:512,height:640,channels:3,background:'#d6d6d6'}}).png().toBuffer();
const outfit = await sharp(await read('tests/fixtures/outfit.svg')).png().toBuffer();
const unlabeled = await png(`
 <svg width="512" height="640" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="640" fill="#ddd"/>
  <rect x="207" y="85" width="98" height="110" rx="8" fill="#333"/>
  <rect x="141" y="190" width="230" height="340" rx="44" fill="#644222"/>
  <rect x="161" y="210" width="190" height="299" rx="29" fill="#84552f"/>
 </svg>
`);
const fictionalLabel = await png(`
 <svg width="700" height="760" xmlns="http://www.w3.org/2000/svg">
  <rect width="700" height="760" fill="#fff"/>
  <rect x="285" y="55" width="130" height="100" rx="10" fill="#111"/>
  <rect x="124" y="150" width="452" height="525" rx="35" fill="#333"/>
  <rect x="165" y="310" width="370" height="180" fill="#fff"/>
  <g text-anchor="middle" fill="#111" font-family="Arial" font-weight="bold">
   <text x="350" y="360" font-size="37">TEST ATELIER</text>
   <text x="350" y="411" font-size="44">VELVET QUAY</text>
   <text x="350" y="458" font-size="25">EAU DE PARFUM</text>
  </g>
 </svg>
`);

async function analyze(task,bytes,mime='image/png') {
 const image = await prepareImage({mime,data:bytes.toString('base64')});
 const text = task==='bottle'?'Read the exact visible fragrance label. Return only uncertain candidates.':undefined;
 return runVision('qwen',LOCAL_MODEL,undefined,task,{image,text});
}

test('typed clothing preserves the stated garments and colors',()=>{
 const result = parseOutfitText('White linen shirt, navy trousers, and brown loafers.');
 assert.equal(result.hasOutfit,true);
 assert.deepEqual(result.garments,['shirt','trousers','loafers']);
 assert.deepEqual(result.colors,['white','navy','brown']);
 assert.deepEqual(result.styleTags,[]);
});

test('typed blazer and trousers support a tailored style',()=>{
 const result = parseOutfitText('Black blazer and gray trousers.');
 assert.deepEqual(result.garments,['blazer','trousers']);
 assert.deepEqual(result.colors,['black','gray']);
 assert.deepEqual(result.styleTags,['tailored']);
});

test('typed mood and a request for longevity provide no outfit evidence',()=>{
 const result = parseOutfitText('I feel tired. Suggest a fragrance and provide its longevity.');
 assert.equal(result.hasOutfit,false);
 assert.deepEqual(result.garments,[]);
 assert.deepEqual(result.colors,[]);
});

test('denied items stay out of the typed outfit attributes',()=>{
 const result = parseOutfitText('White shirt and navy trousers. No tie, no jacket, no hat.');
 assert.deepEqual(result.garments,['shirt','trousers']);
 assert.deepEqual(result.colors,['white','navy']);
});

test('Qwen reports clothing and colors present in the illustrated outfit',async()=>{
 const result = await analyze('outfit',outfit);
 assert.equal(result.hasOutfit,true);
 assert.equal(result.garments.length,3);
 for (const expected of [/\bshirt\b/i,/\b(?:trousers|pants)\b/i,/\b(?:shoes|loafers)\b/i]) {
  assert.ok(result.garments.some(garment=>expected.test(garment)),JSON.stringify(result.garments));
 }
 assert.equal(result.colors.length,3);
 assert.ok(result.colors.includes('white')&&result.colors.includes('brown'));
 assert.ok(result.colors.includes('navy')||result.colors.includes('blue'));
 assert.ok(result.uncertainty.length>0);
});

for (const [description,image] of [['blank image',blank],['unmarked bottle',unlabeled]]) {
 test(`Qwen abstains from describing an outfit in the ${description}`,async()=>{
  const result = await analyze('outfit',image);
  assert.equal(result.hasOutfit,false);
  assert.deepEqual(result.garments,[]);
  assert.deepEqual(result.colors,[]);
 });
}

test('the readable Dior Sauvage EDP label produces one reviewable candidate',async()=>{
 const image = await read('public/catalog/bottles/dior-sauvage-edp-7c860abb0e81.jpg');
 const {candidates} = await analyze('bottle',image,'image/jpeg');
 assert.deepEqual(candidates.map(({brand,name,concentration,confidence})=>({brand,name,concentration,confidence})),[
  {brand:'Dior',name:'Sauvage',concentration:'EDP',confidence:'uncertain'},
 ]);
});

test('the ambiguous Dior Sauvage packshot cannot acquire a concentration',async()=>{
 const image = await read('public/catalog/bottles/dior-sauvage-edt-73f6c1636540.jpg');
 const {candidates} = await analyze('bottle',image,'image/jpeg');
 if (candidates.length) {
  assert.deepEqual(candidates.map(({brand,name,concentration})=>({brand,name,concentration})),[
   {brand:'Dior',name:'Sauvage',concentration:'UNKNOWN'},
  ]);
 }
});

for (const [description,image] of [['unmarked bottle',unlabeled],['blank image',blank]]) {
 test(`the ${description} produces no bottle candidate`,async()=>{
  const {candidates} = await analyze('bottle',image);
  assert.deepEqual(candidates,[]);
 });
}

test('an out-of-catalog bottle can only return the visible synthetic label',async()=>{
 const {candidates} = await analyze('bottle',fictionalLabel);
 if (candidates.length) {
  const [candidate] = candidates;
  assert.equal(candidates.length,1);
  assert.equal(candidate.brand.toLowerCase(),'test atelier');
  assert.equal(candidate.name.toLowerCase(),'velvet quay');
  assert.equal(candidate.concentration,'EDP');
  assert.equal(candidate.confidence,'uncertain');
  assert.equal(findCatalogProfile(candidate),null);
 }
});
