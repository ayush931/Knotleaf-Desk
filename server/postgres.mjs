import {getDefaultAutoSelectFamilyAttemptTimeout,setDefaultAutoSelectFamilyAttemptTimeout} from 'node:net';
// The 250 ms Node default can exhaust remote PostgreSQL addresses before a handshake.
// Preserve an explicitly longer administrator setting; apply to server-side sockets only.
if(getDefaultAutoSelectFamilyAttemptTimeout()<2000)setDefaultAutoSelectFamilyAttemptTimeout(2000);
/** Preserve pg 8's verified-TLS behavior explicitly when supplied sslmode=require. */
export function postgresOptions(connectionString) {
  const url=new URL(connectionString);
  if(!url.searchParams.has('uselibpqcompat')&&['prefer','require','verify-ca'].includes(url.searchParams.get('sslmode')))url.searchParams.set('sslmode','verify-full');
  return {connectionString:url.toString(),max:5,connectionTimeoutMillis:10000,query_timeout:15000};
}
