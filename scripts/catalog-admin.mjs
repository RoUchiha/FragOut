import {privateDataPath} from '../src/lib/private-path.ts';
import {Store} from '../src/lib/store.ts';

const [action,email,...extra]=process.argv.slice(2);
if(!['grant','revoke'].includes(action)||!email||extra.length){
 console.error('Usage: npm run catalog:admin -- grant|revoke ACCOUNT_EMAIL');
 process.exitCode=2;
}else if(process.env.FRAGOUT_DATABASE_URL?.trim()){
 console.error('Cloud catalog access is managed by the database administrator.');
 process.exitCode=1;
}else{
 const store=new Store(privateDataPath());
 try{
  if(!await store.catalogPhotos.setAdmin(email,action==='grant')){
   console.error('Create and sign in to the FragOut account before granting catalog access.');
   process.exitCode=1;
  }else console.log(action==='grant'?'Catalog access granted. Open Settings → FragDex photos.':'Catalog access revoked.');
 }finally{await store.close();}
}
