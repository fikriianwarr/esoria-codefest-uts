import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const code=readFileSync(fileURLToPath(new URL('../app/public/app.js',import.meta.url)),'utf8').replace(/\nbootstrap\(\);\s*$/,'');
function harness() {
  const elems=new Map();
  class Element {
    open=false;
    handlers={};
    addEventListener(event,fn){(this.handlers[event]??=[]).push(fn);}
    dispatch(event){for(const fn of this.handlers[event]??[])fn({target:this,preventDefault(){}});}
    showModal(){this.open=true;this.shows=(this.shows||0)+1;}
    close(){this.open=false;this.dispatch('close');}
    focus(){}
  }
  const query=key=>{if(!elems.has(key))elems.set(key,new Element());return elems.get(key);};
  const context=vm.createContext({
    document:{querySelector:query,addEventListener(){}},
    window:{addEventListener(){}},
    Intl,FormData,Date,URL,URLSearchParams,Promise,clearTimeout,setTimeout,console,
    history:{},location:{pathname:'/'},sessionStorage:{getItem(){},setItem(){},removeItem(){}}
  });
  vm.runInContext(code,context,{filename:'app.js'});
  return {ctx:context,query,run:expression=>vm.runInContext(expression,context)};
}

test('dialog persetujuan mencegah perubahan saat pilih Kembali',async()=>{
  const h=harness();
  const promise=h.run("confirmAction({title:'Simpan?',message:'Lakukan perubahan',accept:'Ya'})");
  assert.equal(h.query('#confirm-dialog').open,true);
  assert.equal(h.query('#confirm-title').textContent,'Simpan?');
  h.query('#confirm-no').dispatch('click');
  assert.equal(await promise,false);
  assert.equal(h.query('#confirm-dialog').open,false);
});

test('dialog persetujuan mengizinkan perubahan hanya setelah tombol Ya',async()=>{
  const h=harness();
  const promise=h.run("confirmAction({title:'Setujui?',message:'Pastikan data valid',accept:'Ya, setujui'})");
  assert.equal(h.query('#confirm-yes').textContent,'Ya, setujui');
  h.query('#confirm-yes').dispatch('click');
  assert.equal(await promise,true);
  assert.equal(h.query('#confirm-dialog').open,false);
});

test('tekan Escape atau keluar dialog diperlakukan sebagai pembatalan',async()=>{
  const h=harness();
  const promise=h.run("confirmAction({title:'Hapus?',message:'Konfirmasi'})");
  h.query('#confirm-dialog').close();
  assert.equal(await promise,false);
});

test('dialog ditolak saat masih ada dialog aktif dan teks pengguna tetap textContent',async()=>{
  const h=harness();
  const promise=h.run("confirmAction({title:'<script>alert(1)</script>',message:'<img src=x>'})");
  assert.equal(h.query('#confirm-title').textContent,'<script>alert(1)</script>');
  assert.equal(h.query('#confirm-message').textContent,'<img src=x>');
  assert.equal(await h.run("confirmAction({title:'Duplikat',message:'Jangan tampilkan'})"),false);
  assert.equal(h.query('#confirm-dialog').shows,1);
  h.query('#confirm-yes').dispatch('click');
  assert.equal(await promise,true);
});

test('semua operasi tulis utama menyiapkan pesan konfirmasi terpisah',()=>{
  const h=harness();
  h.run("state.events=[{id:'web-01',title:'Web',fee:150000}]");
  const types=['register','profile','registration','submission','review','event'];
  for(const type of types) {
    const data={email:'a@example.test',eventId:'web-01',url:'https://example.test',title:'Web',quota:50,fee:150000,status:'approved'};
    const fakeForm={querySelector(){return {defaultValue:''};}};
    const result=h.run(`formConfirmation(${JSON.stringify(type)},${JSON.stringify(data)},{querySelector(){return {defaultValue:''}}})`);
    assert.ok(result.title&&result.message&&result.accept,type);
  }
  assert.equal(h.run("formConfirmation('login',{},{})"),null);
  assert.equal(h.run("formConfirmation('cancel',{},{})"),null); // cancel has its own first-step modal
});
