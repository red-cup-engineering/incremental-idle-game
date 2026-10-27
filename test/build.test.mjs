import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from '../scripts/build.mjs';

test('native publisher produces a self-contained, offline-capable two-world browser app',async()=>{
  const out=await mkdtemp(join(tmpdir(),'little-worlds-'));
  try {
    const result=await build(out);
    assert.equal(result.files.length,9);
    const html=await readFile(join(out,'index.html'),'utf8');
    for(const id of ['tap','prestige','producers','upgrades','export','import','reset','status']) assert.match(html,new RegExp(`id="${id}"`));
    assert.match(html,/No ads, accounts, analytics/);
    const engine=await readFile(join(out,'assets','engine.mjs'),'utf8');
    assert.match(engine,/from '\.\/discrete-clock\.mjs'/);
    const js=await import(pathToFileURL(join(out,'assets','worlds.mjs')).href);
    assert.deepEqual(js.WORLDS.map(w=>w.id),['trace-garden','pocket-observatory']);
    const headers=await readFile(join(out,'_headers'),'utf8');
    assert.match(headers,/connect-src 'none'/);
    const receipt=JSON.parse(await readFile(join(out,'fabrication-receipt.json'),'utf8'));
    assert.equal(receipt.kind,'561.incremental-idle-fabrication-receipt/v1');
    assert.equal(receipt.design.length,2);
    assert.equal(receipt.generated[0].path,'src/generated/world-definitions.mjs');
    for (const artifact of receipt.artifacts) {
      const bytes=await readFile(join(out,artifact.path));
      assert.equal(artifact.digest,'sha256:'+createHash('sha256').update(bytes).digest('hex'));
    }
  } finally {await rm(out,{recursive:true,force:true});}
});
