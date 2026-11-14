import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,canSelectModule,canEnableModule,defaultModuleSelection,initialTradeModuleIds} from '../lib/catalog.mjs';
import {initialWorkspace,prepareInitialWorkspace} from '../lib/initial-workspace.mjs';
function database({exists=false,validAdmin=true}={}){
 const log=[];
 const tx=async(strings,...values)=>{
  const query=strings.join('?').toLowerCase();log.push({query,values});
  if(query.includes('select id from users'))return validAdmin?[{id:'synthetic-admin'}]:[];
  if(query.includes('insert into companies'))return exists?[]:[{id:'synthetic-company',name:values[0]}];
  if(query.includes('select id from companies'))return [{id:'existing-company'}];
  if(query.includes('insert into modules')||query.includes('insert into audit_events'))return [];
  throw Error('Unexpected fixture query');
 };
 return {begin:fn=>fn(tx),log};
}
test('all non-payment modules are selectable but only implemented modules are runnable',()=>{
 assert.equal(catalog.length,50);
 assert.equal(catalog.filter(m=>canSelectModule(m.id)).length,49);
 assert.equal(canSelectModule('customer-payments'),false);
 assert.equal(canSelectModule('unknown'),false);
 assert.equal(canSelectModule('site-diaries'),true);
 assert.equal(canEnableModule('site-diaries'),false);
 assert.equal(canEnableModule('customer-payments'),false);
 assert.equal(canEnableModule('support-tickets'),true);
 assert.equal(catalog.find(m=>m.id==='site-diaries').state,'Coming soon');
});
test('initial trade selection contains only known non-payment catalogue entries',()=>{
 const selection=defaultModuleSelection(true);
 assert.equal(selection.length,49);
 for(const id of initialTradeModuleIds){assert(selection.some(row=>row.moduleId===id&&row.selected));assert(catalog.some(module=>module.id===id));}
 assert(!selection.some(row=>row.moduleId==='customer-payments'));
 assert.equal(selection.find(row=>row.moduleId==='support-tickets').selected,true);
});
test('workspace preparation creates a suspended placeholder and no users or memberships',async()=>{
 const sql=database();const result=await prepareInitialWorkspace(sql,{id:'synthetic-admin',platform_admin:true});
 assert(result.created);assert.equal(initialWorkspace.name,'To be added');assert.equal(initialWorkspace.status,'suspended');
 const insert=sql.log.find(row=>row.query.includes('insert into companies'));
 assert.equal(insert.values[0],'To be added');assert.equal(insert.values[2],'suspended');
 assert(!sql.log.some(row=>row.query.includes('insert into users')||row.query.includes('insert into memberships')));
 assert.equal(sql.log.filter(row=>row.query.includes('insert into modules')).length,49);
});
test('repeating workspace preparation never overwrites existing records',async()=>{
 const sql=database({exists:true});const result=await prepareInitialWorkspace(sql,{id:'synthetic-admin',platform_admin:true});
 assert.equal(result.created,false);assert.equal(result.company.id,'existing-company');
 assert(!sql.log.some(row=>row.query.includes('update ')||row.query.includes('insert into modules')||row.query.includes('delete ')));
});
test('workspace preparation rechecks administrator authority',async()=>{
 await assert.rejects(prepareInitialWorkspace(database(),{id:'synthetic-staff',platform_admin:false}),/Administrator/);
 await assert.rejects(prepareInitialWorkspace(database({validAdmin:false}),{id:'synthetic-admin',platform_admin:true}),/Administrator/);
});
