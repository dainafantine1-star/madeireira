import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {catalog} from '../server/db.js';
import {openDatabase} from './fixtures/database.js';
import {saveBanner} from '../server/company.js';
import {createOwner} from '../server/auth.js';

test('the schema gives the home banner its placement without copying artwork', async t => {
  // Antes isto simulava a migração 008 do SQLite, que aproveitava a primeira
  // arte como banner da home. No Postgres essa migração já roda na criação do
  // schema, então o que importa verificar é o resultado: existe um único banner
  // de home, ele reusa a arte institucional e as promoções não foram duplicadas.
  const db = await openDatabase();
  t.after(() => db.close());

  const homes = await db.all("SELECT * FROM banners WHERE placement='home'");
  assert.equal(homes.length, 1, 'um único banner de home');
  assert.equal(homes[0].image, 'assets/hero-madeira.webp', 'reusa a arte existente');
  assert.equal((await db.get('SELECT count(*) AS n FROM banners')).n, 4, 'nenhuma arte duplicada');

  // Reabrir o mesmo schema não cria um segundo banner de home.
  const outra = await db.reabrir();
  try {
    assert.equal((await outra.get("SELECT count(*) AS n FROM banners WHERE placement='home'")).n, 1);
  } finally {
    await outra.close();
  }
});

test('multiple home banners allowed, unrestricted promotion count, ordering and inactive home state',async()=>{
  const db=await openDatabase();
  try{
    const owner=await createOwner(db,{email:'banners@example.com',password:'BannerPassword12345'});
    const home=await db.get("SELECT * FROM banners WHERE placement='home'");
    await saveBanner(db,owner,{...home,title:'Home',image:'assets/hero-madeira.webp',active:true},home.id);
    const dup=await saveBanner(db,owner,{title:'Duplicate home',placement:'home',active:true,image:'assets/hero-madeira.webp'});assert.ok(dup.id);assert.equal(dup.placement,'home');
    await assert.rejects(()=>saveBanner(db,owner,{...home,version:undefined,placement:'promotion'} ,home.id),/alterada/);
    for(let i=0;i<125;i++)await saveBanner(db,owner,{title:'Promo '+i,sortOrder:125-i,active:true,image:'assets/hero-madeira.webp'});
    const banners=(await catalog(db)).banners.filter(b=>b.placement==='promotion'&&b.image);
    assert.equal(banners.length,125);assert.equal(banners[0].title,'Promo 124');
    const current=await db.get('SELECT * FROM banners WHERE id=?',home.id);
    await saveBanner(db,owner,{...current,active:false},home.id);
    assert.equal((await catalog(db)).banners.find(b=>b.placement==='home').active,0);
    await assert.rejects(()=>saveBanner(db,owner,{...current,active:true},home.id),/mudou/);
  }finally{await db.close();}
});
