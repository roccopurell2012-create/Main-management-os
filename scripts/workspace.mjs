import {db} from '../lib/db.mjs';
import {prepareInitialWorkspace} from '../lib/initial-workspace.mjs';
import {z} from 'zod';
let sql;
try {
 const email=z.email().max(254).parse(process.env.OWNER_EMAIL?.trim().toLowerCase());
 sql=db();
 const [actor]=await sql`select id,platform_admin from users where email=${email} and platform_admin and not disabled`;
 if(!actor)throw new Error('Create the initial owner first');
 const result=await prepareInitialWorkspace(sql,actor);
 console.log(result.created?'Initial workspace prepared as To be added, suspended until setup is completed.':'Existing workspace retained; no records overwritten.');
} catch {console.error('Workspace setup failed. Check owner and database configuration privately.');process.exitCode=1;}
finally {if(sql)await sql.end();}
