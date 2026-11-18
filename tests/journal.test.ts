import assert from 'node:assert/strict';
import {test} from 'node:test';
import {journalSummary,journalCsv,wearDateAt,dayInZone,calendarCells,shiftMonth} from '../src/lib/journal.ts';
import {Store} from '../src/lib/store.ts';
import {defaultContext} from '../src/lib/seed.ts';
import type {WearEvent} from '../src/lib/types.ts';

const event=(id:string,at:string,reaction:WearEvent['reaction']='wore'):WearEvent=>({id,at,reaction,bottleIds:['a','b'],names:['=CMD()','B, "quoted"'],occasion:'GENERAL',context:defaultContext,note:'@private'});
test('calendar layout handles leap years, Sunday starts and year boundaries',()=>{
 assert.equal(calendarCells('2026-11')[0],'2026-11-01');assert.equal(calendarCells('2026-11').filter(Boolean).length,30);
 assert.equal(calendarCells('2024-02').filter(Boolean).length,29);assert.equal(calendarCells('2026-02').filter(Boolean).length,28);
 assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2026-01',-1),'2025-12');
});
test('wear dates use the selected timezone across DST and reject invalid or future dates',()=>{
 for(const date of ['2026-03-08','2026-11-01'])assert.equal(dayInZone(wearDateAt(date,'America/Chicago',new Date('2026-11-18T22:00:00Z').valueOf()),'America/Chicago'),date);
 assert.throws(()=>wearDateAt('2026-02-30','America/Chicago'));
 assert.throws(()=>wearDateAt('2999-01-01','America/Chicago'));
 assert.throws(()=>wearDateAt('2026-01-01','Invalid/Zone'));
 assert.equal(dayInZone('2026-11-01T03:00:00Z','America/Chicago'),'2026-10-31');
});
test('calendar and all-time stats count real wears and layers but not likes or saves',()=>{
 const reply=journalSummary([event('oct','2026-11-01T03:00:00Z'),event('nov','2026-11-01T18:00:00Z'),event('like','2026-11-01T18:00:00Z','saved')],'2026-11','America/Chicago');
 assert.equal(reply.totalWears,2);assert.equal(reply.monthWears,1);assert.equal(reply.days['2026-11-01'],1);
 assert.equal(reply.entries.length,1);assert.equal(reply.mostWorn[0].count,2);assert.equal(reply.mostWorn.length,2);
 assert.equal(reply.layeredWears,2);
});
test('journal CSV escapes formula injection and quoted private notes',()=>{
 const csv=journalCsv([event('entry','2026-11-01T18:00:00Z')],'America/Chicago');
 assert.ok(csv.includes("'=CMD()"));assert.ok(csv.includes("'@private"));assert.ok(csv.includes('""quoted""'));
 assert.ok(!journalCsv([event('save','2026-11-01T18:00:00Z','saved')],'America/Chicago').includes('CMD'));
});
test('journal includes old wear records beyond 200, preserves deleted bottles and isolates owners',async()=>{
 const db=new Store(':memory:');
 try{
  const owner=await db.createDemo(),other=await db.createDemo();
  const bottle=(await db.state(owner.id)).bottles[0];
  const wear=await db.logWear(owner.id,[bottle.id],'2026-03-08','Private wear note');
  for(let i=0;i<205;i++)await db.feedback(owner.id,[bottle.id],'saved','GENERAL');
  assert.equal((await db.state(owner.id)).history.length,200);
  assert.equal((await db.journal(owner.id,'2026-03')).totalWears,1);
  assert.equal((await db.journal(other.id,'2026-03')).totalWears,0);
  assert.equal(await db.editWear(other.id,wear.id,'2026-03-09','Intrusion'),null);
  await db.removeBottle(owner.id,bottle.id);
  const edited=await db.editWear(owner.id,wear.id,'2026-03-09','Edited private note');
  assert.equal(edited?.note,'Edited private note');assert.deepEqual(edited?.names,wear.names);
  assert.equal((await db.journal(owner.id,'2026-03')).entries[0].id,wear.id);
  await assert.rejects(db.logWear(other.id,[bottle.id],'2026-03-09',''),/bottles you own/);
  assert.equal(await db.editWear(owner.id,'unknown','2026-03-09',''),null);
 }finally{await db.close();}
});
