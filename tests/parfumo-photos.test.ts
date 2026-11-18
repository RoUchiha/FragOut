import assert from 'node:assert/strict';
import {test} from 'node:test';
import sharp from 'sharp';
import {parseParfumoPhotoPage,parseParfumoBrands,parseParfumoBrandPage,createParfumoPhotoFinder} from '../src/lib/parfumo-photo.ts';
import type {CatalogEdition} from '../src/lib/types.ts';

const page='https://www.parfumo.com/Perfumes/Dior/Sauvage_Eau_de_Parfum';
const media='https://media.parfumo.com/perfumes/a0/a0ef46-sauvage-eau-de-parfum-dior_1200.jpg';
const edition:CatalogEdition={id:'dior-sauvage-edp',brand:'Dior',name:'Sauvage',concentration:'EDP',releaseYear:2018};
function html({name='Sauvage',brand='Dior',concentration='Eau de Parfum',year=2018,url=page,image=media,extra=''}={}){
 const label=name+(concentration&&!name.endsWith('('+concentration+')')?' ('+concentration+')':'');
 return `<link rel="canonical" href="${url}"><script type="application/ld+json">${JSON.stringify({'@type':'BreadcrumbList',itemListElement:[{name:'Home'},{name:'Brands'},{name:brand},{name:label}]})}</script>
 <meta property="og:image" content="https://media.parfumo.com/perfume_social/a0/social_1200.jpg">
 <h1 class="p_name_h1">${name}<span itemprop="brand">${brand}<a href="https://www.parfumo.com/Release_Years/${year}">${year}</a>${concentration?`<span class="p_con label_a">${concentration}</span>`:''}</span></h1>
 ${extra}<img class="p-main-img" itemprop="image" alt="${label} by ${brand}" src="${image}?width=720&amp;aspect_ratio=1:1">`;
}
test('Parfumo parsing uses the exact curated main bottle, never its social card or gallery',()=>{
 const result=parseParfumoPhotoPage(edition,html({extra:'<img src="https://media.parfumo.com/user_imagery/11/review_1200.jpg">'}),page);
 assert.equal(result?.sourceUrl,page);assert.ok(result?.imageUrl.startsWith(media));assert.equal(result?.concentrationEvidence,'explicit');
 assert.equal(new URL(result!.imageUrl).searchParams.get('width'),'1000');
});
test('wrong houses, flankers, concentrations, release years and canonical pages are rejected',()=>{
 for(const changes of [{brand:'Another House'},{name:'Sauvage Elixir'},{concentration:'Eau de Toilette'},{year:2015},{url:'https://www.parfumo.com/Perfumes/Dior/Other'}])
  assert.equal(parseParfumoPhotoPage(edition,html(changes),page),null,JSON.stringify(changes));
});
test('missing concentrations require an independently checked unique edition',()=>{
 assert.equal(parseParfumoPhotoPage(edition,html({concentration:''}),page),null);
 const layton={id:'parfums-de-marly-layton-edp',brand:'Parfums de Marly',name:'Layton',concentration:'EDP',releaseYear:2016};
 const url='https://www.parfumo.com/Perfumes/Parfums_de_Marly/Layton';
 assert.equal(parseParfumoPhotoPage(layton,html({name:'Layton',brand:layton.brand,concentration:'',year:2016,url}),url)?.concentrationEvidence,'cross-checked-single-edition');
 assert.equal(parseParfumoPhotoPage({...layton,name:'Unknown release'},html({name:'Unknown release',brand:layton.brand,concentration:'',year:2016,url}),url),null);
});
test('an unambiguous checked bottle can use a main image without importing a disputed source year',()=>{
 const afnan={id:'afnan-9pm-edp',brand:'Afnan',name:'9PM',concentration:'EDP',releaseYear:2020};
 const url='https://www.parfumo.com/Perfumes/Afnan_Perfumes/9pm';
 const result=parseParfumoPhotoPage(afnan,html({name:'9pm',brand:'Afnan Perfumes',concentration:'',year:2015,url}),url);
 assert.equal(result?.concentrationEvidence,'cross-checked-single-edition');assert.equal(afnan.releaseYear,2020);
 const unqualified={...edition,name:'Sauvage (2018)'};
 assert.equal(parseParfumoPhotoPage(unqualified,html({concentration:'',year:2015}),page),null);
});
test('only the fixed public product-image host and path can supply a thumbnail',()=>{
 for(const image of ['https://media.parfumo.com/user_imagery/a0/photo.jpg','https://media.parfumo.com/perfume_social/a0/photo.jpg','https://media.parfumo.com/notes_png/a0/photo.png','https://evil.example/perfumes/a0/photo.jpg','http://media.parfumo.com/perfumes/a0/photo.jpg','https://media.parfumo.com/perfumes/a0/box-only_1200.jpg','https://media.parfumo.com/perfumes/a0/../photo.jpg','https://media.parfumo.com/perfumes/a0/logo.svg'])
  assert.equal(parseParfumoPhotoPage(edition,html({image}),page),null,image);
});
test('public brand discovery keeps canonical product links and ignores navigation and third-party links',()=>{
 const brands=parseParfumoBrands('<a class="p-box" href="https://www.parfumo.com/Perfumes/Afnan_Perfumes">Afnan Perfumes<img src="flag.png"></a><a href="https://evil.example/x">Dior</a>');
 assert.deepEqual(brands,[{name:'Afnan Perfumes',url:'https://www.parfumo.com/Perfumes/Afnan_Perfumes'}]);
 const listings=parseParfumoBrandPage(`<div class="col"><a href="${page}"><img alt="Sauvage (Eau de Parfum) by Dior" src="${media}"></a><a href="https://www.parfumo.com/Release_Years/2018">2018</a></div>`,'https://www.parfumo.com/Perfumes/Dior');
 assert.equal(listings[0]?.url,page);assert.equal(listings[0]?.concentration,'EDP');assert.equal(listings[0]?.releaseYear,2018);
});
test('bilingual labels, exact brand sublines and explicit trailing formats retain edition identity',()=>{
 const candidates=[
  {edition:{id:'lattafa-yara-edp',brand:'Lattafa',name:'Yara',concentration:'EDP',releaseYear:2020},name:'Yara / يارا',brand:'Lattafa',concentration:'Eau de Parfum',year:2020},
  {edition:{id:'giorgio-armani-emporio-armani-stronger-with-you-intensely-edp',brand:'Giorgio Armani',name:'Emporio Armani Stronger With You Intensely',concentration:'EDP',releaseYear:2019},name:'Emporio Armani - Stronger With You Intensely',brand:'Giorgio Armani',concentration:'',year:2018},
  {edition:{id:'chanel-bleu-de-chanel-parfum',brand:'Chanel',name:'Bleu de Chanel',concentration:'PARFUM'},name:'Bleu de Chanel Parfum',brand:'Chanel',concentration:'',year:2018},
  {edition:{id:'jean-paul-gaultier-le-male-le-parfum-edp',brand:'Jean Paul Gaultier',name:'Le Male Le Parfum',concentration:'EDP',releaseYear:2020},name:'Le Mâle (Le Parfum)',brand:'Jean Paul Gaultier',concentration:'Le Parfum',year:2020},
  {edition:{id:'yves-saint-laurent-libre-intense-edp',brand:'Yves Saint Laurent',name:'Libre Intense',concentration:'EDP',releaseYear:2020},name:'Libre',brand:'Yves Saint Laurent',concentration:'Eau de Parfum Intense',year:2020},
 ];
 for(const row of candidates)assert.ok(parseParfumoPhotoPage(row.edition,html({...row,url:page}),page),row.name);
 assert.equal(parseParfumoPhotoPage({...edition,name:'Sauvage'},html({name:'Sauvage / Elixir'}),page),null,'A second Latin fragrance label must not be discarded');
});
test('unqualified Acqua di Gio cannot represent both EDT and EDP',()=>{
 const source='https://www.parfumo.com/Perfumes/Giorgio_Armani/Acqua_di_Gio';
 const markup=html({name:'Acqua di Giò',brand:'Giorgio Armani',concentration:'',year:1996,url:source});
 assert.equal(parseParfumoPhotoPage({id:'giorgio-armani-acqua-di-gio-edp',brand:'Giorgio Armani',name:'Acqua di Giò',concentration:'EDP',releaseYear:2022},markup,source),null);
 assert.equal(parseParfumoPhotoPage({id:'giorgio-armani-acqua-di-gio-edt',brand:'Giorgio Armani',name:'Acqua di Giò Eau de Toilette',concentration:'EDT'},markup,source),null);
});
test('the preferred finder downloads a validated main image with no credentials and strips metadata',async()=>{
 const bytes=await sharp(Buffer.from('<svg width="1000" height="1000"><rect width="1000" height="1000" fill="white"/><rect x="360" y="220" width="280" height="650" fill="#2b343b"/><rect x="420" y="100" width="160" height="120" fill="black"/></svg>')).withMetadata({exif:{IFD0:{Artist:'Synthetic photographer'}}}).jpeg().toBuffer();
 const calls:URL[]=[];
 const request:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));calls.push(url);assert.equal(init?.credentials,'omit');assert.equal(init?.redirect,'manual');assert.ok((init?.headers as Record<string,string>)['User-Agent'].startsWith('FragOut/'));
  return url.href===page?new Response(html(),{headers:{'content-type':'text/html'}}):url.hostname==='media.parfumo.com'?new Response(new Uint8Array(bytes),{headers:{'content-type':'image/jpeg'}}):new Response(null,{status:404});
 };
 const photo=await createParfumoPhotoFinder(request)(edition);assert.equal(photo?.publisher,'Parfumo');assert.equal(calls.length,2);
 const metadata=await sharp(photo!.bytes).metadata();assert.equal(metadata.format,'jpeg');assert.equal(metadata.exif,undefined);assert.equal(metadata.width,900);
});
test('cross-origin redirects, non-images and oversized content fail without following the destination',async()=>{
 for(const response of [new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}}),new Response('html',{headers:{'content-type':'text/html'}}),new Response('x',{headers:{'content-type':'image/jpeg','content-length':'9000000'}})]){
  const calls:URL[]=[];
  const request:typeof fetch=async input=>{const url=new URL(String(input));calls.push(url);return url.href===page?new Response(html(),{headers:{'content-type':'text/html'}}):url.hostname==='media.parfumo.com'?response:new Response(null,{status:404});};
  assert.equal(await createParfumoPhotoFinder(request)(edition),null);assert.ok(calls.every(url=>['www.parfumo.com','media.parfumo.com'].includes(url.hostname)));
 }
});

test('identical bottle pixels cannot be assigned to two different fragrance editions',async()=>{
 const bytes=await sharp(Buffer.from('<svg width="900" height="900"><rect width="900" height="900" fill="white"/><rect x="300" y="100" width="300" height="700" fill="#223344"/></svg>')).jpeg().toBuffer();
 const second='https://www.parfumo.com/Perfumes/Chanel/Bleu_de_Chanel_Eau_de_Parfum',collisions:string[][]=[];
 const request:typeof fetch=async input=>{
  const url=new URL(String(input));
  if(url.href===page)return new Response(html(),{headers:{'content-type':'text/html'}});
  if(url.href===second)return new Response(html({name:'Bleu de Chanel',brand:'Chanel',year:2014,url:second}),{headers:{'content-type':'text/html'}});
  return url.hostname==='media.parfumo.com'?new Response(new Uint8Array(bytes),{headers:{'content-type':'image/jpeg'}}):new Response(null,{status:404});
 };
 const find=createParfumoPhotoFinder(request,{onCollision:ids=>collisions.push(ids)});
 assert.ok(await find(edition));
 assert.equal(await find({id:'chanel-bleu-de-chanel-edp',brand:'Chanel',name:'Bleu de Chanel',concentration:'EDP',releaseYear:2014}),null);
 assert.ok(collisions.some(ids=>ids.includes('dior-sauvage-edp')&&ids.includes('chanel-bleu-de-chanel-edp')));
});
