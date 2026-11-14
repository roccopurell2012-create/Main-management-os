export const roles = ['owner', 'manager', 'office administrator', 'supervisor', 'staff member', 'read-only user'];
export const statuses = ['Open', 'In Progress', 'Waiting for Customer', 'Resolved'];
export const priorities = ['Low', 'Normal', 'High', 'Urgent'];
export const categories = ['General', 'Access', 'Billing', 'Problem', 'Feature request', 'Privacy request', 'Security incident'];
const names = `Company overview|Announcements|Calendar|Job scheduling|Site visits|Customer records|Leads and enquiries|Estimates and quotes|Work orders|Job and project tracking|Job milestones|Site diaries|Daily work reports|Timesheets|Staff directory|Staff schedules|Leave requests|Subcontractor directory|Supplier directory|Purchase orders|Materials and inventory|Equipment and tool register|Equipment maintenance|Vehicle fleet|Fuel and mileage logs|Health and safety|Risk assessments|Incident and near-miss reports|Toolbox talks|Permits and compliance documents|Job photos and files|Plans and drawings|Document templates|Customer invoices|Customer payments|Support tickets|Customer service requests|Warranty and callback tracking|Forms and checklists|Customer sign-off|Quality inspections|Job costing|Expenses|Budgets|Reports|Reviews and feedback|Notifications|Team and permissions|Company settings|Help and support`.split('|');
export const catalog = names.map((name, i) => ({ id: name.toLowerCase().replaceAll(' ', '-'), name, icon: ['▦', '◷', '▤', '◇', '☷'][i % 5], description: i === 35 ? 'Contact your platform support team.' : `Manage ${name.toLowerCase()} for your company.`, state: i === 34 ? 'Disabled' : [0, 35, 46, 47, 48, 49].includes(i) ? 'Operational' : 'Coming soon', route: name.toLowerCase().replaceAll(' ', '-') }));
export function canWrite(role) { return roles.includes(role) && role !== 'read-only user'; }
export function canManage(role) { return ['owner', 'manager'].includes(role); }
export function canAssignRole(actorRole, existingRole, targetRole) {
  return roles.includes(targetRole) && canManage(actorRole) && (actorRole === 'owner' || (existingRole !== 'owner' && targetRole !== 'owner'));
}

export function canSelectModule(moduleId) {
  return catalog.some(item => item.id === moduleId) && moduleId !== 'customer-payments';
}

export function canEnableModule(moduleId) {
  const module = catalog.find(item => item.id === moduleId);
  return canSelectModule(moduleId) && module.state === 'Operational';
}

// Provisional construction/electrical selection, not a claim that workflows are implemented.
export const initialTradeModuleIds = Object.freeze([
  'job-scheduling','site-visits','customer-records','leads-and-enquiries','estimates-and-quotes',
  'work-orders','job-and-project-tracking','job-milestones','site-diaries','daily-work-reports',
  'timesheets','staff-directory','staff-schedules','subcontractor-directory','supplier-directory',
  'purchase-orders','materials-and-inventory','equipment-and-tool-register','equipment-maintenance',
  'health-and-safety','risk-assessments','incident-and-near-miss-reports','toolbox-talks',
  'permits-and-compliance-documents','job-photos-and-files','plans-and-drawings',
  'forms-and-checklists','customer-sign-off','quality-inspections'
]);
export function defaultModuleSelection(tradePreset=false) {
  return catalog.filter(module=>canSelectModule(module.id)).map(module=>({
    moduleId:module.id,
    selected:module.state==='Operational'||(tradePreset&&initialTradeModuleIds.includes(module.id)),
  }));
}
