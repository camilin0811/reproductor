import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DoublyLinkedList } from "../dist/doublylinked.js";
import { Player, prevAction } from "../dist/player.js";

function makeList(vals){
  const l=new DoublyLinkedList();
  for(const v of vals) l.addLast(v);
  return l;
}
function seededRng(seed){
  let s=seed;
  return ()=>{ s=(s*1103515245+12345)%2147483648; return s/2147483648; };
}

describe("Player prevAction pure function",()=>{
  it("restart when >3s",()=>{ assert.equal(prevAction(3.1),"restart"); assert.equal(prevAction(10),"restart"); });
  it("prev when <=3s",()=>{ assert.equal(prevAction(0),"prev"); assert.equal(prevAction(3),"prev"); assert.equal(prevAction(2.9),"prev"); });
});

describe("Player shuffle bag - seeded",()=>{
  it("plays every song once before reshuffle, no immediate repeat",()=>{
    const list=makeList([1,2,3,4]);
    const rng=seededRng(42);
    const p=new Player(list, rng);
    p.play(list.nodeAt(0));
    p.enableShuffle();
    const seen=new Set();
    const order=[];
    // el saco tiene las cuatro, en cualquier orden
    for(let i=0;i<4;i++){
      const cur=p.current.value;
      order.push(cur);
      seen.add(cur);
      if(i<3) p.next();
    }
    assert.equal(seen.size,4,`should have seen all 4 in first bag: ${order}`);
    // al agotarse se rebaraja sin encadenar la misma dos veces
    const last=order[order.length-1];
    const nxt=p.next();
    assert.notEqual(nxt.value, last, "no immediate repeat across boundary");
    // el saco nuevo vuelve a traerlas todas
    const seen2=new Set();
    // ya se consumio una del saco nuevo, faltan tres por recoger
    seen2.add(nxt.value);
    for(let i=0;i<3;i++){ const n=p.next(); seen2.add(n.value); }
    assert.equal(seen2.size,4);
  });

  it("history stack allows prev to return to what played",()=>{
    const list=makeList(["a","b","c","d"]);
    const rng=seededRng(1);
    const p=new Player(list, rng);
    p.play(list.nodeAt(0));
    p.enableShuffle();
    const seq=[];
    seq.push(p.current.value);
    for(let i=0;i<3;i++){ p.next(); seq.push(p.current.value); }
    // y hacia atras se deshace el camino andado
    for(let i=seq.length-1;i>0;i--){
      const prev=p.prev();
      assert.equal(prev.value, seq[i-1]);
    }
  });

  it("insert while shuffled keeps bag valid",()=>{
    const list=makeList([1,2,3]);
    const rng=seededRng(99);
    const p=new Player(list, rng);
    p.play(list.nodeAt(0));
    p.enableShuffle();
    const beforeSize=p["bag"].length;
    const newNode=list.addLast(99);
    p.notifyInsert(newNode);
    assert.equal(p["bag"].length, beforeSize+1);
    assert.ok(p["bag"].includes(newNode));
    // una cancion anadida despues acaba apareciendo
    let found=false;
    for(let i=0;i<10;i++){ const n=p.next(); if(n.value===99) {found=true; break;} }
    assert.ok(found, "new node should be reachable via shuffle");
  });

  it("remove while shuffled keeps bag valid",()=>{
    const list=makeList([1,2,3,4]);
    const rng=seededRng(7);
    const p=new Player(list, rng);
    p.play(list.nodeAt(0));
    p.enableShuffle();
    const toRemove=list.nodeAt(1);
    list.removeNode(toRemove);
    p.notifyRemove(toRemove);
    assert.ok(!p["bag"].includes(toRemove));
    assert.equal(p["bag"].length, 3);
  });
});

describe("DoublyLinkedList restore",()=>{
  it("restore inserts at given index",()=>{
    const l=new DoublyLinkedList();
    l.addLast(1); l.addLast(2); l.addLast(3);
    const val=l.removeAt(1);
    assert.deepEqual(l.toArray(),[1,3]);
    l.restore(1,val);
    assert.deepEqual(l.toArray(),[1,2,3]);
    let cur=l.head; let prev=null; let cnt=0;
    while(cur){ assert.equal(cur.prev,prev); prev=cur; cur=cur.next; cnt++; }
    assert.equal(cnt,3);
  });
});

describe("Player setPlaylist keeps playing list",()=>{
  it("switching viewed playlist while playing does not hijack",()=>{
    const a=makeList([1,2]); const b=makeList([10,20]);
    const p=new Player(a);
    p.play(a.nodeAt(0));
    p.setPlayingList(a);
    p.setPlaylist(b);
    assert.equal(p.current.value,1);
    assert.equal(p.getPlayingList(),a);
    assert.equal(p.next().value,2);
  });
});
