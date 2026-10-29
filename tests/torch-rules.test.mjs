import assert from 'node:assert/strict';
import {test} from 'node:test';
import {build} from 'esbuild';
const load=async entry=>{
 const bundle=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'node'});
 return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
};
const T=await load('src/game/torch/torchRules.ts');
const S=await load('src/game/torch/torchSkills.ts');
const W=await load('src/game/torch/torchWorld.ts');
const seeded=seed=>()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};

test('experience carries over several levels and grows the next requirement',()=>{
 const p={level:1,xp:0};
 assert.equal(T.gainXp(p,T.xpToNext(1)+T.xpToNext(2)+5),2);
 assert.equal(p.level,3);assert.equal(p.xp,5);
 assert(T.xpToNext(10)>T.xpToNext(5));
});

test('gear raises stats and a better item replaces a worse one only',()=>{
 const base=T.playerStats(5,{});
 const gear={};
 const weak=T.rollItem(seeded(1),5,'common','weapon');
 const strong=T.rollItem(seeded(2),5,'legend','weapon');
 assert(T.equipIfBetter(gear,weak).equipped);
 assert(T.playerStats(5,gear).damage>base.damage);
 const swap=T.equipIfBetter(gear,strong);
 assert(swap.equipped);assert.equal(swap.discarded.id,weak.id);
 const again=T.equipIfBetter(gear,weak);
 assert.equal(again.equipped,false);assert.equal(again.discarded.id,weak.id);
 assert.equal(gear.weapon.id,strong.id);
});

test('rarer items are stronger on average and rarity odds favour common',()=>{
 const r=seeded(7);
 const avg=(rar)=>{let s=0;for(let i=0;i<200;i++)s+=T.itemPower(T.rollItem(r,10,rar,'armor'));return s/200;};
 assert(avg('legend')>avg('epic')&&avg('epic')>avg('rare')&&avg('rare')>avg('magic')&&avg('magic')>avg('common'));
 const counts={};
 for(let i=0;i<2000;i++){const x=T.rollRarity(r);counts[x]=(counts[x]??0)+1;}
 assert(counts.common>counts.magic&&counts.magic>counts.rare&&counts.rare>(counts.legend??0));
 let boss=0,plain=0;
 for(let i=0;i<2000;i++){if(T.rollRarity(r,5)==='legend')boss++;if(T.rollRarity(r,0)==='legend')plain++;}
 assert(boss>plain,'a bonus shifts the odds towards legendary');
});

test('armour reduces damage with diminishing returns',()=>{
 const d=100;
 assert.equal(T.afterArmor(d,0,1),d);
 assert(T.afterArmor(d,100,1)<T.afterArmor(d,50,1));
 assert(T.afterArmor(d,10000,1)>0,'never fully immune');
 assert(T.afterArmor(d,100,20)>T.afterArmor(d,100,1),'higher-level attackers are mitigated less');
});

test('damage rolls stay near the base and crits hit harder',()=>{
 const r=seeded(3);
 for(let i=0;i<100;i++){const x=T.rollDamage(100,0,r);assert(x.amount>=90&&x.amount<=110&&!x.crit);}
 for(let i=0;i<100;i++){const x=T.rollDamage(100,1,r);assert(x.crit&&x.amount>=157);}
});

test('affixes: rarer gear rolls more of them and every roll is positive',()=>{
 const r=seeded(21);
 const count=(rar)=>{let n=0;for(let i=0;i<50;i++){const it=T.rollItem(r,10,rar,'weapon');n+=it.affixes.length;for(const a of it.affixes)assert(a.value>0);assert.equal(new Set(it.affixes.map(a=>a.stat)).size,it.affixes.length,'no repeated stat');}return n/50;};
 assert.equal(count('common'),0);assert.equal(count('magic'),1);assert.equal(count('rare'),2);assert.equal(count('epic'),3);assert.equal(count('legend'),4);
});

test('affixes and passives add up in the hero stats',()=>{
 const gear={weapon:{...T.rollItem(seeded(5),10,'common','weapon'),affixes:[{stat:'dmgPct',value:0.2},{stat:'lifeSteal',value:0.05}]},ring:{...T.rollItem(seeded(6),10,'common','ring'),affixes:[{stat:'dmgPct',value:0.1},{stat:'cdr',value:0.1}]}};
 const plain=T.playerStats(10,{weapon:{...gear.weapon,affixes:[]},ring:{...gear.ring,affixes:[]}});
 const withAffix=T.playerStats(10,gear);
 assert(Math.abs(withAffix.damage/plain.damage-1.3)<1e-9,'damage percentages add');
 assert.equal(withAffix.lifeSteal,0.05);assert.equal(withAffix.cdr,0.1);
 const book=S.newBook();book.passives.might=5;book.passives.haste=5;
 const p=T.playerStats(10,gear,S.passiveBonus(book));
 assert(Math.abs(p.damage/plain.damage-1.5)<1e-9);assert(Math.abs(p.cdr-0.25)<1e-9);
 assert(T.playerStats(1,{weapon:{...gear.weapon,affixes:[{stat:'lifeSteal',value:5}]}}).lifeSteal<=0.25,'life steal is capped');
});

test('enhancing: costs grow, success is certain at first and fades, a failure keeps the item',()=>{
 const it=T.rollItem(seeded(8),10,'rare','armor');
 const c0=T.enhanceCost(it);
 it.enhance=5;
 const c5=T.enhanceCost(it);
 assert(c5.gold>c0.gold&&c5.essence>c0.essence);
 assert.equal(T.enhanceChance(0),1);assert(T.enhanceChance(9)<T.enhanceChance(4));
 const fresh=T.rollItem(seeded(9),10,'rare','armor');
 const wallet={gold:100000,essence:1000};
 const base=T.itemStat(fresh,'armor');
 assert.equal(T.tryEnhance(fresh,wallet,()=>0.5),'success');
 assert.equal(fresh.enhance,1);assert(T.itemStat(fresh,'armor')>base);
 fresh.enhance=8;
 const before=wallet.gold;
 assert.equal(T.tryEnhance(fresh,wallet,()=>0.99),'fail');
 assert.equal(fresh.enhance,8,'a failed attempt does not lower the item');assert(wallet.gold<before,'but the cost is paid');
 assert.equal(T.tryEnhance(fresh,{gold:0,essence:0},()=>0),'poor');
 fresh.enhance=T.ENHANCE_MAX;assert.equal(T.tryEnhance(fresh,wallet,()=>0),'max');
});

test('salvaging gives more essence for rarer and higher gear; selling pays more once enhanced',()=>{
 const r=seeded(12);
 const common=T.rollItem(r,5,'common','helm'),legend=T.rollItem(r,5,'legend','helm'),high=T.rollItem(r,40,'common','helm');
 assert(T.salvageYield(legend)>T.salvageYield(common)&&T.salvageYield(high)>T.salvageYield(common));
 const v=T.sellValue(common);common.enhance=5;assert(T.sellValue(common)>v);
 assert(T.itemTitle(common).endsWith('+5'));
});

test('monsters grow with their level and the roster follows the zone',()=>{
 for(const k of ['grunt','archer','brute','boss']){const d=T.ENEMIES[k];assert(T.monsterHp(d,10)>T.monsterHp(d,1)&&T.monsterDamage(d,10)>T.monsterDamage(d,1)&&T.monsterXp(d,10)>T.monsterXp(d,1));}
 const r=seeded(13);
 const camps=W.generateCamps();
 const meadow=camps.find(c=>c.zone==='meadow'&&!c.boss&&!c.champion);
 for(let i=0;i<30;i++)assert(!T.campRoster(meadow,r).some(e=>e.kind==='brute'||e.kind==='boss'),'the meadow has no brutes');
 const boss=camps.find(c=>c.boss);
 const roster=T.campRoster(boss,r);
 assert.equal(roster.filter(e=>e.kind==='boss').length,1);assert.equal(roster.length,boss.size+1);
 const champ=camps.find(c=>c.champion&&c.zone!=='meadow');
 assert(T.campRoster(champ,r).some(e=>e.champion&&e.kind==='brute'));
});

test('bosses always drop gear, potions and essence; champions always drop an item; grunts mostly little',()=>{
 const r=seeded(11);
 const boss=T.rollDrops('boss',5,r);
 assert(boss.items.length>=3&&boss.hpPotion&&boss.mpPotion&&boss.gold>0&&boss.essence>=3);
 for(let i=0;i<50;i++)assert(T.rollDrops('brute',8,r,{champion:true}).items.length>=1);
 let items=0;
 for(let i=0;i<1000;i++)items+=T.rollDrops('grunt',1,r).items.length;
 assert(items>40&&items<250,`grunt item drops ${items}`);
 assert(T.rollDrops('grunt',10,seeded(1),{goldFind:1}).gold>T.rollDrops('grunt',10,seeded(1)).gold,'gold find pays');
});

test('the world: zones ring the village, levels rise outward, camps are fixed and spaced',()=>{
 assert.equal(W.zoneAt(0,0).id,'village');
 assert.equal(W.zoneAt(40,0).id,'meadow');assert.equal(W.zoneAt(0,90).id,'forest');assert.equal(W.zoneAt(-125,0).id,'swamp');assert.equal(W.zoneAt(150,60).id,'volcano');
 assert(W.levelAt(60,0)>W.levelAt(25,0)&&W.levelAt(150,100)>W.levelAt(100,0));
 assert(W.inVillage(0,0)&&!W.inVillage(30,0));
 const a=W.generateCamps(),b=W.generateCamps();
 assert.deepEqual(a,b,'the same world every time');
 assert.equal(a.filter(c=>c.boss).length,4,'one boss per zone');
 for(const z of ['meadow','forest','swamp','volcano'])assert(a.filter(c=>c.zone===z&&!c.boss).length>=8,`${z} has camps`);
 for(const c of a){assert(Math.abs(c.x)<=W.WORLD_HALF&&Math.abs(c.z)<=W.WORLD_HALF);assert(!W.inVillage(c.x,c.z));}
 for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(!a[i].boss&&!a[j].boss)assert(Math.hypot(a[i].x-a[j].x,a[i].z-a[j].z)>=16.9,'camps do not overlap');
 assert.equal(a.filter(c=>c.boss).map(c=>c.zone).sort().join(),'forest,meadow,swamp,volcano');
});

test('skills: learning needs points and level, ranks cap at five, runes unlock at rank three',()=>{
 const b=S.newBook();
 assert.equal(b.points,1);
 assert.equal(S.learn(b,'frost',1),false,'level too low');
 assert(S.learn(b,'bolt',1));assert.equal(b.points,0);assert.equal(b.slots[0],'bolt','the first skill takes the first slot');
 assert.equal(S.learn(b,'bolt',1),false,'no points left');
 b.points=10;
 for(let i=0;i<4;i++)assert(S.learn(b,'bolt',1));
 assert.equal(S.rankOf(b,'bolt'),5);assert.equal(S.learn(b,'bolt',1),false,'rank five is the cap');
 assert(S.learn(b,'whirl',5));assert.equal(b.slots[1],'whirl');
 assert.equal(S.setRune(b,'whirl',0),false,'rank one has no rune');
 assert(S.setRune(b,'bolt',0));assert.equal(S.activeRune(b,'bolt'),'burn');
 assert.equal(S.setRune(b,'bolt',3),false);
 assert(S.setRune(b,'bolt',-1));assert.equal(S.activeRune(b,'bolt'),null);
});

test('skill slots: binding moves a skill, only learned skills can be bound',()=>{
 const b=S.newBook();b.points=5;
 S.learn(b,'bolt',9);S.learn(b,'whirl',9);S.learn(b,'leap',9);
 assert.deepEqual(b.slots.slice(0,3),['bolt','whirl','leap']);
 assert.equal(S.bind(b,0,'meteor'),false,'not learned');
 assert(S.bind(b,0,'leap'));
 assert.deepEqual(b.slots.slice(0,3),['leap','whirl','bolt'],'leap swapped places with bolt');
 assert(S.bind(b,4,'whirl'));assert.equal(b.slots[4],'whirl');assert.equal(b.slots[1],null,'whirl left its old slot');
 assert(S.bind(b,4,null));assert.equal(b.slots[4],null);assert.equal(S.bind(b,9,'bolt'),false);
});

test('skill ranks and runes change the numbers they should',()=>{
 const b=S.newBook();b.points=30;
 for(let i=0;i<5;i++)S.learn(b,'bolt',9);
 const r5=S.skillRuntime(b,'bolt');
 const b1=S.newBook();S.learn(b1,'bolt',9);const r1=S.skillRuntime(b1,'bolt');
 assert(r5.mult>r1.mult&&r5.cooldown<r1.cooldown&&r5.radius>r1.radius&&r5.cost>r1.cost);
 const withRune=(i)=>{S.setRune(b,'bolt',i);return S.skillRuntime(b,'bolt');};
 assert(withRune(0).burn>0&&withRune(0).mult===r5.mult);
 assert(withRune(1).mult>r5.mult&&withRune(1).cost>r5.cost);
 assert(withRune(2).echo);
 S.learn(b,'whirl',9);S.learn(b,'whirl',9);S.learn(b,'whirl',9);
 const w=S.skillRuntime(b,'whirl');
 S.setRune(b,'whirl',2);assert(S.skillRuntime(b,'whirl').cooldown<w.cooldown,'swift rune shortens the cooldown');
 S.setRune(b,'whirl',1);assert(S.skillRuntime(b,'whirl').radius>w.radius,'wide rune enlarges');
 S.setRune(b,'whirl',0);assert(S.skillRuntime(b,'whirl').vamp>0);
 assert(S.skillRuntime(b,'whirl',0.3).cooldown<S.skillRuntime(b,'whirl').cooldown,'cooldown reduction applies');
 assert(S.skillRuntime(b,'whirl',5).cooldown>=0.4,'never below the floor');
});

test('passives: ranks cap and add to the stats',()=>{
 const b=S.newBook();b.points=40;
 assert.equal(S.learnPassive(b,'haste',3),false,'level too low');
 for(let i=0;i<5;i++)assert(S.learnPassive(b,'might',1));
 assert.equal(S.learnPassive(b,'might',1),false,'rank five is the cap');
 const bonus=S.passiveBonus(b);assert(Math.abs(bonus.dmgPct-0.2)<1e-9);assert.equal(bonus.hpPct,0);
 assert.equal(S.pointsSpent(b),5);
});

test('every skill is castable, the ultimate is costly and a fresh hero can afford it',()=>{
 for(const id of S.SKILL_LIST){const s=S.SKILLS[id];assert(s.cost>0&&s.cooldown>0&&s.mult>0&&s.delay<s.lock+0.3&&s.runes.length===3&&new Set(s.runes).size===3);for(const r of s.runes)assert(S.RUNE_TEXT[r]);}
 assert.equal(S.SKILL_LIST.length,new Set(S.SKILL_LIST).size);
 assert.equal(Math.max(...S.SKILL_LIST.map(id=>S.SKILLS[id].cost)),S.SKILLS.nova.cost);
 assert(S.SKILLS.nova.cooldown>=Math.max(...S.SKILL_LIST.map(id=>S.SKILLS[id].cooldown)));
 assert(T.playerStats(1,{}).maxMp>=S.SKILLS.bolt.cost);
 assert(S.SKILLS.bolt.reqLevel===1,'a hero can learn a skill at level one');
});
