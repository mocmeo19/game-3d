import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
const load=async entry=>{
 const bundle=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'node'});
 return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
};
const R=await load('src/game/rules.ts');
const {NavGrid}=await load('src/game/nav.ts');

test('fire rate, magazine and reload lock',()=>{
 const w=R.newWeapon('ak47');w.deployLeft=0;
 assert.equal(R.consumeShot(w),0);assert.equal(w.ammo,29);
 assert.equal(R.consumeShot(w),-1,'cannot fire again before the cycle time');
 R.tickWeapon(w,.1);assert.equal(R.consumeShot(w),1,'second bullet uses spray index 1');
 assert(R.beginReload(w));assert.equal(R.consumeShot(w),-1);
 R.tickWeapon(w,R.WEAPONS.ak47.reload);assert.equal(w.ammo,30);assert.equal(w.reserve,88);
});
test('a freshly drawn weapon cannot fire until deployed',()=>{
 const w=R.newWeapon('awp');assert.equal(R.consumeShot(w),-1);R.tickWeapon(w,R.WEAPONS.awp.deploy);assert.equal(R.consumeShot(w),0);
});
test('reload never creates ammo',()=>{
 for(const id of ['glock','usp','deagle','mp9','ak47','m4a4','awp']){
  const w=R.newWeapon(id);w.deployLeft=0;w.ammo=1;w.reserve=2;assert(R.beginReload(w));R.tickWeapon(w,10);
  assert.equal(w.ammo,3);assert.equal(w.reserve,0);assert.equal(R.beginReload(w),false);
 }
});
test('spray: first shot has no punch, recoil climbs, then recovers when not firing',()=>{
 assert.deepEqual(R.aimPunch('ak47',0),[0,0]);
 const [,p10]=R.aimPunch('ak47',9);assert(p10>0.1,'AK climbs ~6 degrees by the 10th bullet');
 const [y14]=R.aimPunch('ak47',13);assert(y14<0,'then pulls left');
 const w=R.newWeapon('ak47');w.deployLeft=0;
 for(let i=0;i<10;i++){R.consumeShot(w);R.tickWeapon(w,.1);}
 assert(w.recoil>=9);R.tickWeapon(w,2);assert.equal(w.recoil,0);
});
test('inaccuracy: standing < walking < running, crouch helps, air is worst, scope fixes the AWP',()=>{
 const ak=R.newWeapon('ak47');
 const at=(speed,crouched=false,airborne=false)=>R.inaccuracy(ak,{speed,crouched,airborne});
 const run=R.MOVE.run*R.WEAPONS.ak47.speed;
 assert.equal(at(0),at(run*R.MOVE.accurateFraction*.9),'slow walking is as accurate as standing');
 assert(at(run)>at(run*.6));assert(at(run*.6)>at(0));assert(at(0,true)<at(0));assert(at(0,false,true)>at(run));
 const awp=R.newWeapon('awp');const still={speed:0,crouched:false,airborne:false};
 const noscope=R.inaccuracy(awp,still);awp.zoom=1;assert(R.inaccuracy(awp,still)<noscope/20);
});
test('damage: hit groups, helmet, kevlar and range falloff',()=>{
 assert(R.computeDamage('ak47',36,5,'head',100,true).health>=100,'AK one-taps through a helmet');
 assert(R.computeDamage('m4a4',33,5,'head',100,true).health<100,'M4A4 does not');
 assert.equal(R.computeDamage('ak47',36,0,'head',100,false).health,144,'no helmet: full x4');
 assert(R.computeDamage('awp',115,30,'chest',100,true).health>=100,'AWP body shot kills');
 const legs=R.computeDamage('ak47',36,0,'legs',100,true);assert.equal(legs.armor,0,'kevlar does not cover legs');assert.equal(legs.health,27);
 const chest=R.computeDamage('ak47',36,0,'chest',100,true);assert(chest.health<36&&chest.armor>0);
 assert(R.computeDamage('mp9',26,40,'chest',0,false).health<R.computeDamage('mp9',26,2,'chest',0,false).health,'falloff');
});
test('penetration: thin walls let reduced damage through, thick ones stop it',()=>{
 const thin=R.penetrate('ak47',36,.4);assert(thin>0&&thin<36);
 assert.equal(R.penetrate('glock',30,.4),0);assert.equal(R.penetrate('ak47',36,1.2),0);
 assert(R.penetrate('awp',115,.4)>R.penetrate('ak47',36,.4));
});
test('economy: loss bonus ladder and money cap',()=>{
 assert.deepEqual([1,2,3,4,5,6].map(R.lossBonus),[1400,1900,2400,2900,3400,3400]);
 assert.equal(R.addMoney(15900,3250),16000);assert.equal(R.addMoney(100,-500),0);
});
test('buying: side restrictions, prices, replacing a gun drops the old one',()=>{
 const inv=R.newInventory('CT');
 assert.match(R.buyBlock('ak47',inv,9000,'CT'),/Chỉ phe T/);
 assert.match(R.buyBlock('m4a4',inv,800,'CT'),/Không đủ tiền/);
 const first=R.buy('mp9',inv,5000,'CT');assert.equal(first.money,3750);assert.equal(inv.primary.id,'mp9');assert.equal(inv.active,1);
 const second=R.buy('m4a4',inv,first.money,'CT');assert.equal(second.dropped.id,'mp9');assert.equal(inv.primary.id,'m4a4');
 const kev=R.buy('kevlar',inv,1000,'CT');assert.equal(kev.money,350);assert.equal(R.itemPrice('helmet',inv),350,'helmet upgrade is cheaper with kevlar');
 assert.equal(R.buy('kevlar',inv,1000,'CT'),null);
});
test('grenades: per-type limits, cycling slot 4, back to the gun after the last throw',()=>{
 const inv=R.newInventory('T');
 R.buy('flash',inv,9000,'T');R.buy('flash',inv,9000,'T');assert.match(R.buyBlock('flash',inv,9000,'T'),/đủ/);
 R.buy('he',inv,9000,'T');
 assert(R.selectSlot(inv,4));assert.equal(inv.grenade.id,'flash');assert(R.selectSlot(inv,4));assert.equal(inv.grenade.id,'he');
 R.spendGrenade(inv);assert.equal(inv.active,4);assert.equal(inv.grenades.length,2);
 R.spendGrenade(inv);R.spendGrenade(inv);assert.notEqual(inv.active,4);assert.equal(inv.grenades.length,0);assert.equal(R.selectSlot(inv,4),false);
});
test('dropping: knife stays, pistol can be dropped and picked back up',()=>{
 const inv=R.newInventory('CT');R.selectSlot(inv,3);assert.equal(R.dropActive(inv),null);
 R.selectSlot(inv,2);const usp=R.dropActive(inv);assert.equal(usp.id,'usp');assert.equal(inv.secondary,null);assert.equal(inv.active,3);
 assert.equal(R.equip(inv,usp),null);assert.equal(inv.active,2);
});
test('movement collision: walls block, crates can be jumped onto, roofs are overhead',()=>{
 const crate={min:{x:-.6,y:0,z:-.6},max:{x:.6,y:1.2,z:.6}};
 const roof={min:{x:-5,y:3.4,z:-5},max:{x:5,y:3.7,z:5}};
 assert(R.blocked(0,.8,[crate]));assert(!R.blocked(0,1.2,[crate]));
 assert(!R.blocked(0,0,[crate],R.MOVE.radius,1.2),'standing on top of the crate');
 assert.equal(R.groundHeight(0,0,[crate],1.25),1.2);assert.equal(R.groundHeight(0,0,[crate],.5),0,'too high to step up');
 assert(!R.blocked(0,0,[roof]));assert(R.blocked(R.WORLD_LIMIT+1,0,[]),"the edge of the whole map");
});
test('rayBox returns entry and exit distances',()=>{
 const wall={min:{x:-1,y:0,z:4.8},max:{x:1,y:3,z:5.2}};
 const [t0,t1]=R.rayBox(0,1,0,0,0,1,wall,100);assert(Math.abs(t0-4.8)<1e-9&&Math.abs(t1-5.2)<1e-9);
 assert.equal(R.rayBox(0,1,0,0,0,-1,wall,100),null);assert.equal(R.rayBox(0,1,0,0,0,1,wall,3),null);
});
test('bots can route around a wall',()=>{
 const wall={min:{x:-10,y:0,z:-.5},max:{x:10,y:3,z:.5}};
 const nav=new NavGrid(30,(x,z)=>R.blocked(x,z,[wall],.55));
 const path=nav.path({x:0,z:-8},{x:0,z:8});
 assert(path.length>=2,'goes around, not through');
 assert.deepEqual(path.at(-1),{x:0,z:8});
 let prev={x:0,z:-8};for(const p of path){assert(nav.clear(prev,p));prev=p;}
});
test('bots do not route through a thin fence between two open cells',()=>{
 // 0.12 m thick, lying on a cell border: both neighbouring cell centres are open, only the step between them is not
 const fence={min:{x:-10,y:0,z:-.06},max:{x:10,y:1.5,z:.06}};
 const nav=new NavGrid(30,R.makeBlocked([fence],.5),2);
 const path=nav.path({x:-1,z:-8},{x:-1,z:8});
 assert(path.length>=2,'a path exists around the fence');
 let prev={x:-1,z:-8},crossed=false;
 for(const p of path){assert(nav.clear(prev,p),'every leg is free');if((prev.z<0)!==(p.z<0)&&Math.abs(prev.x+(p.x-prev.x)*(0-prev.z)/(p.z-prev.z))<10)crossed=true;prev=p;}
 assert(!crossed,'no leg crosses the fence');
});

const BR=await load('src/game/royale.ts');
test('royale: armour reduces damage, wears out and breaks',()=>{
 const b=BR.newBRInventory();
 assert.equal(BR.brDamage(40,'chest',b).health,40,'no vest: full damage');
 b.vest={level:3,durability:BR.GEAR.vest.durability[3]};
 const hit=BR.brDamage(40,'chest',b);assert(Math.abs(hit.health-18)<1e-9,'level 3 vest takes 55%');assert.equal(b.vest.durability,210);
 assert.equal(BR.brDamage(40,'legs',b).health,36,'legs are not armoured');
 b.helmet={level:1,durability:10};const head=BR.brDamage(40,'head',b);assert(head.broke);assert.equal(b.helmet,null);
});
test('royale: carry weight limits loot, backpacks raise it',()=>{
 const b=BR.newBRInventory();
 assert.equal(BR.capacity(b),BR.BASE_CAPACITY);
 assert.equal(BR.roomFor(b,{kind:'med',med:'medkit',count:9}),4,'80 / 20 = 4 medkits');
 b.backpack=3;assert.equal(BR.roomFor(b,{kind:'med',med:'medkit',count:9}),9);
 b.ammo['7.62']=400;assert.equal(BR.roomFor(b,{kind:'ammo',ammo:'.300',count:50}),50);
 b.backpack=0;assert.equal(BR.roomFor(b,{kind:'ammo',ammo:'9mm',count:30}),0,'over weight already');
});
test('royale: gear upgrades and heal choice',()=>{
 const b=BR.newBRInventory();
 assert(BR.isUpgrade(b,{kind:'gear',gear:'vest',level:1,durability:200}));
 b.vest={level:2,durability:220};
 assert(!BR.isUpgrade(b,{kind:'gear',gear:'vest',level:1,durability:200}));assert(BR.isUpgrade(b,{kind:'gear',gear:'vest',level:3,durability:250}));
 b.meds.bandage=5;b.meds.firstaid=1;b.meds.medkit=1;
 assert.equal(BR.bestHeal(b,30),'medkit');assert.equal(BR.bestHeal(b,55),'firstaid');assert.equal(BR.bestHeal(b,70),'bandage');assert.equal(BR.bestHeal(b,90),null);
 assert.equal(BR.healAmount('firstaid',30),45);assert.equal(BR.healAmount('bandage',70),5);assert.equal(BR.healAmount('medkit',30),70);
 assert(BR.boostEffect(95).speed>BR.boostEffect(50).speed);assert.equal(BR.boostEffect(0).healPerSec,0);
});
test('royale: every zone lies inside the previous one, timeline shrinks it',()=>{
 let s=7;const rand=()=>{s=(s*16807)%2147483647;return s/2147483647;};
 for(let k=0;k<20;k++){
  const c=BR.planZones(rand,110);
  for(let i=1;i<c.length;i++)assert(Math.hypot(c[i].x-c[i-1].x,c[i].z-c[i-1].z)+c[i].r<=c[i-1].r+1e-6,'nested');
 }
 const c=BR.planZones(rand,110);
 const z0=BR.zoneAt(c,10);assert.equal(z0.cur.r,160);assert(!z0.shrinking);
 const z1=BR.zoneAt(c,80);assert(z1.shrinking&&z1.cur.r<160&&z1.cur.r>75);
 const end=BR.zoneAt(c,1e6);assert.equal(end.cur.r,0);
});
test('royale: loot rolls are well formed',()=>{
 let s=3;const rand=()=>{s=(s*16807)%2147483647;return s/2147483647;};
 for(let i=0;i<500;i++)for(const l of BR.rollLoot(rand,i%2===0)){
  assert(['weapon','ammo','gear','med','grenade'].includes(l.kind));
  if(l.kind==='ammo')assert(l.count>0&&BR.AMMO_NAME[l.ammo]);
  if(l.kind==='weapon')assert(R.WEAPONS[l.id]);
 }
});
