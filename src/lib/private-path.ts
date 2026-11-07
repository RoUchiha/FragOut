import {isAbsolute,join,relative,resolve,sep} from 'node:path';
// Keep runtime filesystem paths out of the request proxy's traced dependency graph.
export function privateDataPath(value=process.env.FRAGOUT_DB??join(process.cwd(),'data','fragout.sqlite'),root=process.cwd()){
 const path=resolve(/* turbopackIgnore: true */ value);
 for(const folder of ['public','.next/static','mobile/native-dist','mobile/dist']){
  const rel=relative(resolve(root,folder),path);
  if(rel===''||(rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel)))throw new Error('Private data cannot be stored in public or packaged asset directories.');
 }
 return path;
}
