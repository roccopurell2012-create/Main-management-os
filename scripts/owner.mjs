import {db} from '../lib/db.mjs';
import {passwordHash,passwordInput} from '../lib/password.mjs';
import {z} from 'zod';
let sql;
try {
  const email=z.email().max(254).parse(process.env.OWNER_EMAIL?.trim().toLowerCase());
  const password=passwordInput(process.env.OWNER_PASSWORD,14);
  sql=db();
  await sql`insert into users(email,password_hash,name,platform_admin) values(${email},${await passwordHash(password)},'Platform owner',true)`;
  console.log('Owner created. Remove bootstrap password from the environment.');
} catch {
  console.error('Owner setup failed. Check the supplied email/password, duplicate account and database configuration privately.');
  process.exitCode=1;
} finally {if(sql)await sql.end()}
