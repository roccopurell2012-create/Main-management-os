import {readdir,readFile} from 'node:fs/promises';
const skip=new Set(['node_modules','.next','.git','.vercel']);
async function files(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){if(skip.has(e.name))continue;const path=dir+'/'+e.name;if(e.isDirectory())result.push(...await files(path));else if(e.isFile())result.push(path)}return result}
// Deliberately print only locations, never matching material. Heuristic, not proof.
const rules=[
 ['private key',new RegExp('-----BEGIN '+'(?:RSA |EC |OPENSSH )?PRIVATE KEY-----')],
 ['provider token',new RegExp('(?:gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|sk_live_[A-Za-z0-9]{16,})')],
 ['credential-bearing URL',new RegExp('(?:postgres(?:ql)?|mysql)://[^\\s:/]+:[^\\s@]+@')],
];
let count=0,inspected=0;
for(const file of await files('.')){
 if(!/\.(?:js|mjs|json|md|sql|css|example|txt)$/.test(file)&&!file.includes('/.env'))continue;
 const body=await readFile(file,'utf8');inspected++;
 for(const [index,line] of body.split('\n').entries()){
  for(const [kind,pattern] of rules)if(pattern.test(line)){console.error(`${file}:${index+1}: potential ${kind}; inspect privately`);count++}
  if(file.includes('/.env')&&!file.endsWith('.example')&&/^[A-Z_]*(?:SECRET|PASSWORD|TOKEN|KEY|URL)\s*=\s*\S+/.test(line)){console.error(`${file}:${index+1}: configured sensitive variable; inspect privately`);count++}
 }
}
console.log(`Inspected ${inspected} source/configuration files; ${count} candidate locations. No values printed. Git history, provider stores and ignored build output are outside this heuristic check.`);
process.exitCode=count?1:0;
