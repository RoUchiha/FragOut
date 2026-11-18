const words=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
 .replace(/[’']/g,'').replace(/&/g,' and ').replace(/[^\p{L}\p{N}+-]+/gu,' ').trim();

export function declaresInspiration(description:string,name:string,brand:string) {
 const text=' '+words(description)+' ';
 const fragrance=words(name+' by '+brand)+' ';
 const prefixes=[
  ' inspired by ',' inspired expression of ',' inspired impression of ',
  ' inspired version of ',' inspiration ',' draws inspiration from ',
 ];
 return prefixes.some(prefix=>text.includes(prefix+fragrance))||
  [' this ',' our ',' a '].some(prefix=>text.includes(prefix+fragrance+'dupe '));
}
