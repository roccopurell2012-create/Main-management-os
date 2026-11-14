import {defaultModuleSelection} from './catalog.mjs';
export const initialWorkspace = Object.freeze({
 name:'To be added',slug:'initial-workspace',status:'suspended',
 color:'#b85b30',timezone:'Africa/Johannesburg',welcome:'Workspace needs setup',
});
export async function prepareInitialWorkspace(sql,actor) {
 if(!actor?.platform_admin)throw new Error('Administrator access required');
 return sql.begin(async tx=>{
  const [admin]=await tx`select id from users where id=${actor.id} and platform_admin and not disabled`;
  if(!admin)throw new Error('Administrator access required');
  const [company]=await tx`insert into companies(name,slug,status,color,timezone,welcome)
   values(${initialWorkspace.name},${initialWorkspace.slug},${initialWorkspace.status},${initialWorkspace.color},${initialWorkspace.timezone},${initialWorkspace.welcome})
   on conflict(slug) do nothing returning *`;
  if(!company){const [existing]=await tx`select id from companies where slug=${initialWorkspace.slug}`;return {company:existing,created:false};}
  for(const selection of defaultModuleSelection(true))
   await tx`insert into modules(company_id,module_id,enabled) values(${company.id},${selection.moduleId},${selection.selected})`;
  await tx`insert into audit_events(company_id,actor_id,action) values(${company.id},${actor.id},'Initial workspace prepared; needs setup')`;
  return {company,created:true};
 });
}
