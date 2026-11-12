import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/lib/store.ts';
import {findPublicCatalogEdition} from '../src/lib/catalog-editions.ts';
import {isCatalogPhotoPath} from '../src/lib/catalog-photos.ts';

const fahrenheit={brand:'Christian Dior',name:'Fahrenheit EDT',concentration:'EDT'};
const sauvage={brand:'Dior',name:'Sauvage',concentration:'EDP'};

test('photo discovery resolves only an exact public edition',()=>{
 const edition=findPublicCatalogEdition(fahrenheit);
 assert.equal(edition?.name,'Fahrenheit');
 assert.equal(edition?.concentration,'EDT');
 assert.equal(findPublicCatalogEdition({...fahrenheit,name:'Custom outfit notes'}),null);
 assert.equal(findPublicCatalogEdition({...fahrenheit,concentration:'UNKNOWN'}),null);
 assert.equal(findPublicCatalogEdition({brand:'YSL',name:"La Nuit de L'Homme",concentration:'EDP'}),null);
 assert.equal(findPublicCatalogEdition({brand:'Versace',name:'The Dreamer',concentration:'EDT'})?.id,
  'scento:versace-the-dreamer-toilette');
});

test('automatic, manual and hidden thumbnails stay scoped to their exact edition',async()=>{
 const store=new Store(':memory:');
 try {
  const edition=findPublicCatalogEdition(fahrenheit)!;
  const photo={bytes:Buffer.from('automatic'),sourceUrl:'https://maker.example.com/fahrenheit',publisher:'Fixture maker'};
  assert.equal(await store.catalogPhotos.reserve(edition.id,100),true);
  assert.equal(await store.catalogPhotos.reserve(edition.id,101),false);
  await store.catalogPhotos.saveAutomatic(edition,photo);
  const automatic=(await store.catalogPhotos.profile(fahrenheit))?.photo;
  assert.ok(automatic&&isCatalogPhotoPath(automatic.path));
  assert.ok(!isCatalogPhotoPath(automatic.path+'/../../private'));
  const key=automatic.path.split('/').at(-1)!;
  assert.deepEqual(await store.catalogPhotos.asset(key),photo.bytes);
  assert.equal(await store.catalogPhotos.profile({...fahrenheit,concentration:'EDP'}),null);
  await store.catalogPhotos.setOverride(edition,Buffer.from('manual'));
  const override=(await store.catalogPhotos.profile(fahrenheit))?.photo;
  assert.ok(override&&override.path!==automatic.path);
  assert.equal(await store.catalogPhotos.asset(key),null);
  await store.catalogPhotos.saveAutomatic(edition,photo);
  assert.equal((await store.catalogPhotos.profile(fahrenheit))?.photo?.path,override.path);
  await store.catalogPhotos.setOverride(edition,null);
  assert.equal(await store.catalogPhotos.profile(fahrenheit),null);
  assert.equal(await store.catalogPhotos.asset(override.path.split('/').at(-1)!),null);
  await store.catalogPhotos.reset(edition);
  assert.equal((await store.catalogPhotos.profile(fahrenheit))?.photo?.path,automatic.path);
  const bundled=findPublicCatalogEdition(sauvage)!;
  assert.ok((await store.catalogPhotos.profile(sauvage))?.photo);
  await store.catalogPhotos.setOverride(bundled,null);
  assert.equal((await store.catalogPhotos.profile(sauvage))?.photo,undefined);
 } finally {await store.close();}
});

test('only a locally granted registered account gets the catalog admin flag',async()=>{
 const store=new Store(':memory:');
 try {
  const owner=await store.register('Owner','owner@example.test','synthetic-password');
  const other=await store.register('Other','other@example.test','synthetic-password');
  const demo=await store.createDemo();
  assert.equal(await store.catalogPhotos.setAdmin('missing@example.test',true),false);
  assert.equal((await store.state(owner.id)).user.catalogAdmin,undefined);
  assert.equal(await store.catalogPhotos.setAdmin('OWNER@EXAMPLE.TEST',true),true);
  assert.equal((await store.state(owner.id)).user.catalogAdmin,true);
  assert.equal((await store.state(other.id)).user.catalogAdmin,undefined);
  assert.equal((await store.state(demo.id)).user.catalogAdmin,undefined);
  await store.catalogPhotos.setAdmin('owner@example.test',false);
  assert.equal((await store.state(owner.id)).user.catalogAdmin,undefined);
 } finally {await store.close();}
});

test('simultaneous saves share one lookup and an admin correction wins over the pending result',async()=>{
 const store=new Store(':memory:');
 try {
  const edition=findPublicCatalogEdition(fahrenheit)!;
  const photo={bytes:Buffer.from('late automatic'),sourceUrl:'https://maker.example.com/fahrenheit',publisher:'Fixture maker'};
  const started=Promise.withResolvers<void>();
  const finish=Promise.withResolvers<void>();
  let calls=0;
  const select=async()=>{
   calls++;
   started.resolve();
   await finish.promise;
   return photo;
  };
  const first=store.catalogPhotos.ensure(edition,select,()=>true);
  const second=store.catalogPhotos.ensure(edition,select,()=>true);
  await Promise.race([started.promise,first.then(()=>assert.fail('Discovery ended before the photo lookup.'))]);
  assert.equal(calls,1);
  await store.catalogPhotos.setOverride(edition,Buffer.from('admin preferred'));
  finish.resolve();
  await Promise.all([first,second]);
  assert.equal((await store.catalogPhotos.entry(edition)).status,'override');
  await store.catalogPhotos.ensure(edition,select,()=>true,true);
  assert.equal(calls,1);
  await store.catalogPhotos.reset(edition);
  assert.equal((await store.catalogPhotos.entry(edition)).status,'automatic');
  await store.catalogPhotos.ensure(edition,async()=>{calls++;return null;},()=>true,true);
  assert.equal(calls,2);
  assert.equal((await store.catalogPhotos.entry(edition)).status,'automatic');
 }finally{await store.close();}
});

test('catalog discovery waits for asynchronous admission before looking up a photo',async()=>{
 const store=new Store(':memory:');
 try{
  const edition=findPublicCatalogEdition(fahrenheit)!;
  await store.catalogPhotos.ensure(edition,async()=>({
   bytes:Buffer.from('unadmitted photo'),sourceUrl:'https://maker.example.com/fahrenheit',publisher:'Fixture maker',
  }),async()=>false);
  assert.equal((await store.catalogPhotos.entry(edition)).status,'missing');
 }finally{await store.close();}
});

test('a concurrent admitted discovery can proceed when the earlier caller is denied',async()=>{
 const store=new Store(':memory:');
 try{
  const edition=findPublicCatalogEdition(fahrenheit)!;
  const waiting=Promise.withResolvers<void>();
  const decision=Promise.withResolvers<boolean>();
  const denied=store.catalogPhotos.ensure(edition,async()=>assert.fail('A denied request reached the photo lookup.'),()=>{
   waiting.resolve();
   return decision.promise;
  });
  await Promise.race([waiting.promise,denied.then(()=>assert.fail('Discovery ended before admission.'))]);
  const admitted=store.catalogPhotos.ensure(edition,async()=>({
   bytes:Buffer.from('admitted photo'),sourceUrl:'https://maker.example.com/fahrenheit',publisher:'Fixture maker',
  }),async()=>true);
  decision.resolve(false);
  await Promise.all([denied,admitted]);
  assert.equal((await store.catalogPhotos.entry(edition)).status,'automatic');
 }finally{await store.close();}
});
