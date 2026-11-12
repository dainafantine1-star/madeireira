import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {catalog} from '../server/db.js';
import {openDatabase} from './fixtures/database.js';
import {saveBanner} from '../server/company.js';
import {createOwner} from '../server/auth.js';

test('banner migration reuses existing artwork without copying it into promotions',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'mp-banners-')),path=join(dir,'test.sqlite');
  let db;
  try{
    db=await openDatabase(path);
    await db.exec("DROP INDEX IF EXISTS banners_single_home; DELETE FROM banners WHERE placement='home'; ALTER TABLE banners DROP COLUMN placement; DELETE FROM migrations WHERE name IN ('008_banner_placements.sql','009_multiple_home_banners.sql'); UPDATE banners SET image='assets/hero-madeira.webp' WHERE id=1;");
    await db.close();db=await openDatabase(path);
    const home=await db.get("SELECT * FROM banners WHERE placement='home'");
    assert.equal(home.id,1);assert.equal(home.image,'assets/hero-madeira.webp');
    assert.equal((await db.get('SELECT count(*) n FROM banners')).n,3);
    await db.close();db=await openDatabase(path);
    assert.equal((await db.get("SELECT count(*) n FROM banners WHERE placement='home'")).n,1);
  }finally{await db?.close();rmSync(dir,{recursive:true,force:true});}
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
