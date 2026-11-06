import {test} from 'node:test';
import assert from 'node:assert/strict';
import {contextSchema,settingsSchema,bottleSchema} from '../src/lib/validation.ts';
import {defaultContext,defaultShortcuts} from '../src/lib/seed.ts';
test('out-of-range weather and invalid timezone are rejected',()=>{
 assert.equal(contextSchema.safeParse({...defaultContext,tempC:100}).success,false);
 assert.equal(contextSchema.safeParse({...defaultContext,timezone:'Not/A_Timezone'}).success,false);
});
test('duplicate shortcut IDs and excessive shortcuts are rejected',()=>{
 assert.equal(settingsSchema.safeParse({shortcuts:[defaultShortcuts[0],defaultShortcuts[0]]}).success,false);
 assert.equal(settingsSchema.safeParse({shortcuts:Array.from({length:21},(_,i)=>({...defaultShortcuts[0],id:String(i)}))}).success,false);
});
test('client cannot assign owner IDs, canonical identity or demo provenance',()=>{
 assert.equal(bottleSchema.partial().safeParse({userId:'someone-else'}).success,false);
 assert.equal(bottleSchema.partial().safeParse({variantId:'stolen'}).success,false);
 assert.equal(bottleSchema.partial().safeParse({provenance:'demo'}).success,false);
});
