import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {correctVibeAudit} from '../scripts/correct-vibe-audit.mjs';
const load=(name:string)=>JSON.parse(readFileSync(new URL('../docs/evaluations/'+name,import.meta.url),'utf8'));
const before=load('2026-11-24-vibes-before.json'),source=load('2026-11-21-layering.json');

test('the disclosed cozy rubric correction reclassifies old choices without reranking or mutating evidence',()=>{
 const frozen=JSON.stringify(before),corrected=correctVibeAudit(before,source.cases);
 assert.equal(JSON.stringify(before),frozen);assert.equal(corrected.engineVersion,'1.3.0');
 assert.equal(corrected.summary.backendBestFirst,8);assert.equal(corrected.summary.outfitBestFirst,8);
 const choices=(audit:typeof before)=>audit.rows.map((r:typeof before.rows[number])=>({id:r.id,solo:r.solo,backend:r.backend.map(({direction,...choice}:typeof r.backend[number])=>choice),outfit:r.outfit.map(({direction,...choice}:typeof r.outfit[number])=>choice),qwen:r.rawQwen.map((p:typeof r.rawQwen[number])=>p.ids),sol:r.rawSol.map((p:typeof r.rawSol[number])=>p.ids)}));
 assert.deepEqual(choices(corrected),choices(before));
 assert.deepEqual(corrected.rows.filter((r:typeof before.rows[number])=>r.id!=='l03'),before.rows.filter((r:typeof before.rows[number])=>r.id!=='l03'));
 const cozy=corrected.rows.find((r:typeof before.rows[number])=>r.id==='l03');
 assert.equal(cozy.topQuality,6);assert.equal(cozy.bestAvailableDirection,6);
 assert.deepEqual(cozy.expectations.primary,['f03','f05','f06','f07','f08']);assert.deepEqual(cozy.expectations.supporting,['f01','f02']);
});

test('cozy supporting cues include equivalent duplicate editions',()=>{
 const input=structuredClone(before),row=input.rows.find((r:typeof before.rows[number])=>r.id==='l03');
 row.rawQwen.push({ids:['f12','f02'],direction:{primary:0,supporting:1}});
 const result=correctVibeAudit(input,source.cases).rows.find((r:typeof before.rows[number])=>r.id==='l03');
 assert.deepEqual(result.rawQwen.at(-1).direction,{primary:0,supporting:2});
});

test('correction refuses already revised or unrelated baseline rubrics',()=>{
 assert.throws(()=>correctVibeAudit(correctVibeAudit(before,source.cases),source.cases));
 const input=structuredClone(before);input.rows.find((r:typeof before.rows[number])=>r.id==='l03').expectations.primary.push('f01');
 assert.throws(()=>correctVibeAudit(input,source.cases));
});
