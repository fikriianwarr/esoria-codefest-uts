import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?walk(path.join(dir,f.name)):[path.join(dir,f.name)]);
const errors=[];
for(const file of [...walk(path.join(root,'app')),...walk(path.join(root,'scripts')),...walk(path.join(root,'tests'))].filter(f=>/\.(mjs|js)$/.test(f))) {
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0)errors.push(`${path.relative(root,file)}: ${r.stderr}`);
}
const html=readFileSync(path.join(root,'app/public/index.html'),'utf8');
for(const m of html.matchAll(/(?:href|src)="(\/(?:assets\/[^" ]+|app\.js|styles\.css))"/g))if(!existsSync(path.join(root,'app/public',m[1])))errors.push(`Aset hilang: ${m[1]}`);
for(const file of walk(path.join(root,'app/public'))) {
  const content=readFileSync(file,'utf8');
  if(/(?:src|href)=["']https?:\/\//.test(content)&&file.endsWith('.html'))errors.push('HTML memuat aset eksternal: '+file);
  if(file.endsWith('.html')&&/\bon\w+\s*=|<style[ >]|<script(?![^>]*src=)[^>]*>\S/.test(content))errors.push('HTML mengandung handler/style inline yang tidak sesuai CSP.');
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Pemeriksaan sintaks dan aset lokal ESORIA UTS lulus.');
