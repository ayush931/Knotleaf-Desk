import {test,expect} from 'bun:test';
import pg from 'pg';
import {createRoomStore} from '../server/database.mjs';
test.skipIf(!process.env.TEST_DATABASE_URL)('self-hosted PostgreSQL stores room invitations and later snapshots across connections',async()=>{
 const url=process.env.TEST_DATABASE_URL,id=crypto.randomUUID(),first=createRoomStore(url),second=createRoomStore(url);
 try{await first.create(id,'Lesson','initial-state',{title:'Lesson',elements:[],markdownNotes:'Before'},`https://desk.example/canvas/${id}`);expect((await second.load(id)).state).toBe('initial-state');
 await first.save(id,'next-state',{title:'Updated',elements:[],markdownNotes:'After'});expect((await second.load(id)).state).toBe('next-state');
 const pool=new pg.Pool({connectionString:url});try{const {rows}=await pool.query('SELECT share_url,snapshot FROM knotleaf_rooms WHERE id=$1',[id]);expect(rows[0].share_url).toBe(`https://desk.example/canvas/${id}`);expect(rows[0].snapshot.markdownNotes).toBe('After');await pool.query('DELETE FROM knotleaf_rooms WHERE id=$1',[id]);}finally{await pool.end();}
 }finally{await first.close();await second.close();}
});
