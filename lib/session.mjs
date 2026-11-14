import {cookies} from 'next/headers';
import {db} from './db.mjs';
import {tokenHash} from './password.mjs';
export async function revokeCurrentSession(){
  const jar=await cookies();
  const token=jar.get('portal_session')?.value;
  if(token)await db()`delete from sessions where token_hash=${tokenHash(token)}`;
  jar.delete('portal_session');
}
