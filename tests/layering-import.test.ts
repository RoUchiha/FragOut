import assert from 'node:assert/strict';
import {test} from 'node:test';
import {declaresInspiration} from '../scripts/lib/declared-inspiration.ts';

test('dupe import requires a direct inspiration claim instead of a comparison elsewhere in the description',()=>{
 const copy='Compared with Aventus by Creed. Our inspired expression of Cedrat Boise by Mancera.';
 assert.equal(declaresInspiration(copy,'Aventus','Creed'),false);
 assert.equal(declaresInspiration(copy,'Cedrat Boise','Mancera'),true);
});

test('dupe import keeps flanker prefixes and Commodity plus and minus editions distinct',()=>{
 assert.equal(declaresInspiration('Inspired by Absolu Aventus by Creed.','Aventus','Creed'),false);
 assert.equal(declaresInspiration('Inspired by Absolu Aventus by Creed.','Absolu Aventus','Creed'),true);
 assert.equal(declaresInspiration('Inspired by Milk- by Commodity.','Milk','Commodity'),false);
 assert.equal(declaresInspiration('Inspired by Milk+ by Commodity.','Milk','Commodity'),false);
 assert.equal(declaresInspiration('Inspired by Milk by Commodity.','Milk','Commodity'),true);
});
