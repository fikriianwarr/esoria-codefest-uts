import { loadEnvFile } from 'node:process';
import { existsSync } from 'node:fs';
import { createApplication } from '../app/server.mjs';

if(existsSync('.env')) loadEnvFile('.env');
const {server}=await createApplication();
const argument = name => {const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
const port=Number(argument('--port') || process.env.PORT || 3000);
server.listen(port,argument('--host') || process.env.HOST || '0.0.0.0',()=>console.log(`ESORIA siap pada port ${port}. Gunakan npm test untuk pengujian terpisah.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
