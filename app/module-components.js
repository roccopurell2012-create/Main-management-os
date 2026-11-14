import Link from 'next/link';
import ActionForm from './action-form';
import Submit from './submit';
import {catalog,roles,canManage,canSelectModule,canEnableModule} from '../lib/catalog.mjs';
import {saveModule} from './actions';
export function ModuleSettings({company,modules}) {
 return <div className="module-settings">{catalog.map(module=>{
  const setting=modules.find(row=>row.module_id===module.id);
  const selectable=canSelectModule(module.id),ready=canEnableModule(module.id);
  const status=!selectable?'Disabled — no website payments':ready?(setting?.enabled?'Enabled':'Disabled'):(setting?.enabled?'Selected · Coming soon':'Coming soon');
  return <details className="panel" key={module.id}>
   <summary><span aria-hidden="true">{module.icon}</span> {module.name} <span className="badge">{status}</span></summary>
   {!selectable?<><label className="check"><input type="checkbox" disabled checked={false} readOnly/>Website payment collection is disabled</label><p>Payments are arranged separately. No checkout or payment-provider connection is available.</p></>:
   <ActionForm action={saveModule}>
    <input name="company" type="hidden" value={company}/><input name="module" type="hidden" value={module.id}/>
    <label className="check"><input name="enabled" type="checkbox" defaultChecked={setting?.enabled??false}/>{ready?'Enable module':'Select module for this workspace'}</label>
    {!ready&&<p className="notice">Coming soon. Selection records your preference and displays a labelled tile; it does not activate this workflow.</p>}
    {module.id==='customer-invoices'&&<p>Invoice records only when implemented. No checkout, payment collection or payment-provider integrations.</p>}
    <fieldset><legend>Roles with access when available</legend>{roles.map(role=><label className="check" key={role}><input name="roles" type="checkbox" value={role} defaultChecked={(setting?.allowed_roles??roles).includes(role)}/>{role}</label>)}</fieldset>
    <label>Reserved module settings (JSON object)<textarea name="settings" defaultValue={JSON.stringify(setting?.settings??{},null,2)}/></label>
    <p className="muted">Reserved settings do not change unfinished module behaviour.</p><Submit>Save selection</Submit>
   </ActionForm>}
  </details>;
 })}</div>;
}
export function ModuleTiles({slug,role,modules}) {
 const visible=catalog.filter(module=>canSelectModule(module.id)&&modules.some(row=>row.module_id===module.id&&row.allowed_roles.includes(role))&&(module.id!=='team-and-permissions'||canManage(role)));
 return <div className="tiles">{visible.map(module=>{
  const contents=<><span aria-hidden="true" className="tile-icon">{module.icon}</span><h3>{module.name}</h3><p>{module.id==='customer-invoices'?'Invoice records only; no website payments.':module.description}</p>{canEnableModule(module.id)?<span className="tile-link">Open page ↗</span>:<><span className="badge">Coming soon</span><p>Selected for this workspace. This workflow is not yet available.</p></>}</>;
  return canEnableModule(module.id)?<Link className="tile" key={module.id} href={'/c/'+slug+'/'+module.id}>{contents}</Link>:<article className="tile coming-soon" key={module.id}>{contents}</article>;
 })}</div>;
}
