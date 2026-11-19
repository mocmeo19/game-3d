import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
const load=async entry=>{
 const bundle=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'node'});
 return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
};
const R=await load('src/games/core/rules.ts');
const {NavGrid}=await load('src/games/core/agents/nav.ts');

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
 assert(!R.blocked(0,0,[roof]));
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
