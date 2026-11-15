import Link from 'next/link';
import ActionForm from './action-form';
import Submit from './submit';
import {catalog,roles,canManage,canSelectModule,canEnableModule} from '../lib/catalog.mjs';
import {saveModule,toggleModule} from './actions';

export function ModuleSettings({company,modules}) {
 return <div className="module-settings">{catalog.map(module=>{
  const setting=modules.find(row=>row.module_id===module.id), selectable=canSelectModule(module.id), enabled=Boolean(setting?.enabled);
  return <section className="module-setting" key={module.id}>
   <div className="module-setting-main"><div><strong><span aria-hidden="true">{module.icon}</span> {module.name}</strong><small>{selectable?module.description:'Payments are disabled for this portal.'}</small></div>
    {!selectable?<span className="badge">Disabled</span>:<ActionForm action={toggleModule}><input name="company" type="hidden" value={company}/><input name="module" type="hidden" value={module.id}/><button className={'module-switch '+(enabled?'on':'off')} type="submit" role="switch" aria-checked={enabled} aria-label={'Turn '+(enabled?'off':'on')+' '+module.name} name="enabled" value={enabled?'off':'on'}>{enabled?'ON':'OFF'}</button></ActionForm>}
   </div>
   {selectable&&<details className="module-permissions"><summary>Access and permissions</summary><ActionForm action={saveModule}>
    <input name="company" type="hidden" value={company}/><input name="module" type="hidden" value={module.id}/><input name="enabled" type="hidden" value={enabled?'on':'off'}/><input name="settings" type="hidden" value={JSON.stringify(setting?.settings??{})}/>
    <fieldset><legend>Who can open this page?</legend>{roles.map(role=><label className="check" key={role}><input name="roles" type="checkbox" value={role} defaultChecked={(setting?.allowed_roles??roles).includes(role)}/>{role}</label>)}</fieldset>
    <Submit>Save access</Submit>
   </ActionForm></details>}
  </section>;
 })}</div>;
}
export function ModuleTiles({slug,role,modules}) {
 const visible=catalog.filter(module=>canEnableModule(module.id)&&modules.some(row=>row.module_id===module.id&&row.enabled&&row.allowed_roles.includes(role))&&(module.id!=='team-and-permissions'||canManage(role)));
 return <div className="tiles">{visible.map(module=>{
  const description=module.id==='customer-invoices'?'Keep invoice records here. Online payments are disabled.':module.description;
  return <Link className="tile" key={module.id} href={'/c/'+slug+'/'+module.id}><span aria-hidden="true" className="tile-icon">{module.icon}</span><h3>{module.name}</h3><p>{description}</p><span className="tile-link">Open page ↗</span></Link>;
 })}</div>;
}
