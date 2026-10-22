import {postgresOptions} from '../server/postgres.mjs';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
if(process.loadEnvFile){try{process.loadEnvFile('.env');}catch{}}
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required.');
const pool=new pg.Pool(postgresOptions(process.env.DATABASE_URL));
let client;
try{
 client=await pool.connect();await client.query('SELECT 1');
 const {rows}=await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='knotleaf_rooms'");
 for(const name of ['id','title','share_path','share_url','state_base64','snapshot','created_at','updated_at','host_token_hash'])if(!rows.some(r=>r.column_name===name))throw new Error(`Missing room schema column: ${name}`);
 await client.query('BEGIN');const id=randomUUID(),snapshot={title:'Connection check',elements:[],markdownNotes:'Temporary connectivity check'};
 await client.query('INSERT INTO knotleaf_rooms (id,title,share_path,share_url,state_base64,snapshot) VALUES ($1,$2,$3,$4,$5,$6)',[id,snapshot.title,`/canvas/${id}`,`https://example.invalid/canvas/${id}`,'test-state',JSON.stringify(snapshot)]);
 const saved=await client.query('SELECT snapshot,state_base64 FROM knotleaf_rooms WHERE id=$1',[id]);if(saved.rows[0]?.snapshot.markdownNotes!==snapshot.markdownNotes||saved.rows[0]?.state_base64!=='test-state')throw new Error('Database read/write verification failed');
 await client.query('UPDATE knotleaf_rooms SET title=$2 WHERE id=$1',[id,'Updated check']);const updated=await client.query('SELECT title FROM knotleaf_rooms WHERE id=$1',[id]);if(updated.rows[0]?.title!=='Updated check')throw new Error('Database update verification failed');
 await client.query('ROLLBACK');console.log('PASS: PostgreSQL reachable, room schema ready, write/read/update verified. Temporary data rolled back.');
}finally{if(client){try{await client.query('ROLLBACK');}catch{}client.release();}await pool.end();}
