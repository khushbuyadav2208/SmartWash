import './env.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb, transaction } from './db.js';
import { User, Student, Hostel, Schedule, Order, Notification, Issue, Audit } from './models.js';
import { newId, email } from './domain.js';
const source=path.resolve(process.argv.find(a=>a.startsWith('--source='))?.slice(9)||'data/db.json');
const commit=process.argv.includes('--commit');
try {
  const raw=await fs.readFile(source);const db=JSON.parse(raw);const errors=[];
  const unique=(items,key,label)=>{const seen=new Set();for(const item of items){const val=key(item);if(!val||seen.has(val))errors.push(`${label}: missing/duplicate ${val}`);seen.add(val);}};
  for(const key of ['users','students','hostels','requests','schedules','issues','notifications'])if(!Array.isArray(db[key])) errors.push(`${key} must be an array`);
  if(errors.length)throw new Error(errors.join('\n'));
  unique(db.users,u=>email(u.email),'user email');unique(db.students,s=>s.laundryId,'laundry ID');unique(db.students.flatMap(s=>s.tags||[]),t=>t.serialNumber,'tag serial');
  const hostels=db.hostels.map(h=>({...h,rooms:db.rooms?.[h.id]||[],active:true}));
  const students=db.students;const users=[];
  for(const u of db.users){const student=students.find(s=>s.id===u.studentId);users.push({id:u.id,email:email(u.email),name:u.name||student?.name,role:u.role,studentId:u.studentId,hostelId:u.hostelId,counter:u.counter,active:true,verified:true,passwordHash:u.passwordHash||await bcrypt.hash(String(u.password||''),12)});if(!u.passwordHash&&!u.password)errors.push(`User ${u.id} has no password`);if(u.role==='student'&&!student)errors.push(`User ${u.id}: student missing`);}
  const schedules=db.schedules.map(s=>({...s,maxWeight:s.maxWeight??5,extraWeightRate:s.extraWeightRate??20,capacity:s.capacity??100,processingHours:s.processingHours??24}));
  const orders=db.requests.map(r=>({...r,pickupDate:r.pickupDate||String(r.createdAt).slice(0,10)}));
  const issues=db.issues.map(i=>({...i,hostelId:students.find(s=>s.id===i.studentId)?.hostelId}));
  const notifications=db.notifications;const entries=[[Hostel,hostels,'id'],[Student,students,'id'],[User,users,'id'],[Schedule,schedules,'hostelId'],[Order,orders,'id'],[Issue,issues,'id'],[Notification,notifications,'id']];
  for(const [Model,items,key]of entries){unique(items,r=>r[key],Model.modelName);for(const item of items){try{await new Model(item).validate();}catch(e){errors.push(`${Model.modelName} ${item[key]}: ${e.message}`);}}}
  const active=new Set();for(const r of orders){const st=students.find(s=>s.id===r.studentId);if(!st||r.hostelId!==st.hostelId)errors.push(`Order ${r.id}: invalid student/hostel`);for(const tag of r.scannedTags||[])if(!st?.tags.some(t=>t.serialNumber===tag))errors.push(`Order ${r.id}: unregistered scanned tag ${tag}`);if(!['Delivered','Cancelled'].includes(r.status)){if(active.has(r.studentId))errors.push(`Duplicate active order for ${r.studentId}`);active.add(r.studentId);}}
  for(const s of students)if(!hostels.some(h=>h.id===s.hostelId&&h.rooms.includes(s.room)))errors.push(`Student ${s.id}: invalid hostel/room`);
  if(errors.length){console.error('Migration blocked. No database writes.\n'+errors.join('\n'));process.exitCode=1;}
  else {
    console.log(JSON.stringify({mode:commit?'commit':'dry-run',records:Object.fromEntries(entries.map(([M,rows])=>[M.modelName,rows.length]))},null,2));
    if(commit){await connectDb();const backupDir=path.resolve('backups');await fs.mkdir(backupDir,{recursive:true,mode:0o700});const stamp=Date.now();const backup=path.join(backupDir,`legacy-${stamp}.json`);await fs.writeFile(backup,raw,{flag:'wx',mode:0o600});
      const checksum=b=>createHash('sha256').update(b).digest('hex');if(checksum(await fs.readFile(backup))!==checksum(raw))throw new Error('Backup verification failed');
      const target={};for(const[M]of entries)target[M.modelName]=await M.find().lean();const targetBackup=path.join(backupDir,`mongodb-before-${stamp}.json`);await fs.writeFile(targetBackup,JSON.stringify(target,null,2),{flag:'wx',mode:0o600});JSON.parse(await fs.readFile(targetBackup,'utf8'));const counts={inserted:0,skipped:0};
      await transaction(async session=>{counts.inserted=0;counts.skipped=0;for(const[M,rows,key]of entries)for(const row of rows){const existing=await M.findOne({[key]:row[key]}).session(session);if(existing){const identity=M===User?['email','role','studentId','hostelId']:M===Student?['email','laundryId','hostelId','room']:M===Order?['studentId','laundryId','hostelId','status']:M===Hostel?['name']:[];if(identity.some(k=>String(existing[k]??'')!==String(row[k]??'')))throw new Error(`Conflicting existing ${M.modelName} ${row[key]}; no records overwritten`);counts.skipped++;continue;}await M.create([row],{session});counts.inserted++;}await Audit.create([{id:newId('a'),actorId:'migration',action:'migration.import',details:counts}],{session});});console.log(JSON.stringify({backup,targetBackup,...counts}));}
  }
}catch(e){console.error('Migration failed; transaction rolls back on failure:',e.message);process.exitCode=1;}finally{await disconnectDb();}
