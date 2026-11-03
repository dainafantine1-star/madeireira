import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDatabase,catalog} from '../server/db.js';
import {saveBanner} from '../server/company.js';
import {createOwner} from '../server/auth.js';

test('banner migration reuses existing artwork without copying it into promotions',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mp-banners-')),path=join(dir,'test.sqlite');
  let db;
  try{
    db=openDatabase(path);
    db.exec("DROP INDEX IF EXISTS banners_single_home; DELETE FROM banners WHERE placement='home'; ALTER TABLE banners DROP COLUMN placement; DELETE FROM migrations WHERE name IN ('008_banner_placements.sql','009_multiple_home_banners.sql'); UPDATE banners SET image='assets/hero-madeira.webp' WHERE id=1;");
    db.close();db=openDatabase(path);
    const home=db.prepare("SELECT * FROM banners WHERE placement='home'").get();
    assert.equal(home.id,1);assert.equal(home.image,'assets/hero-madeira.webp');
    assert.equal(db.prepare('SELECT count(*) n FROM banners').get().n,3);
    db.close();db=openDatabase(path);
    assert.equal(db.prepare("SELECT count(*) n FROM banners WHERE placement='home'").get().n,1);
  }finally{db?.close();rmSync(dir,{recursive:true,force:true});}
});

test('multiple home banners allowed, unrestricted promotion count, ordering and inactive home state',()=>{
  const db=openDatabase(':memory:');
  try{
    const owner=createOwner(db,{email:'banners@example.com',password:'BannerPassword12345'});
    const home=db.prepare("SELECT * FROM banners WHERE placement='home'").get();
    saveBanner(db,owner,{...home,title:'Home',image:'assets/hero-madeira.webp',active:true},home.id);
    const dup=saveBanner(db,owner,{title:'Duplicate home',placement:'home',active:true,image:'assets/hero-madeira.webp'});assert.ok(dup.id);assert.equal(dup.placement,'home');
    assert.throws(()=>saveBanner(db,owner,{...home,version:undefined,placement:'promotion'} ,home.id),/alterada/);
    for(let i=0;i<125;i++)saveBanner(db,owner,{title:'Promo '+i,sortOrder:125-i,active:true,image:'assets/hero-madeira.webp'});
    const banners=catalog(db).banners.filter(b=>b.placement==='promotion'&&b.image);
    assert.equal(banners.length,125);assert.equal(banners[0].title,'Promo 124');
    const current=db.prepare('SELECT * FROM banners WHERE id=?').get(home.id);
    saveBanner(db,owner,{...current,active:false},home.id);
    assert.equal(catalog(db).banners.find(b=>b.placement==='home').active,0);
    assert.throws(()=>saveBanner(db,owner,{...current,active:true},home.id),/mudou/);
  }finally{db.close();}
});
