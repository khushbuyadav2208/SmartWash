// Called only by the existing bootstrap CLI. No automatic initialization.
import {randomUUID} from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {models,User,Student,Hostel,Schedule,Order,Issue,Notification,ScanEvent,Audit,Session,AuthToken} from './models.js';
import {transaction} from './db.js';
import {password,digest,localDate,statuses} from './domain.js';
export const DEMO_BATCH='smartwash-demo-v1';
export function requireDemoEnvironment(){if(!['development','test'].includes(process.env.NODE_ENV)||process.env.DEMO_DATA_ENABLED!=='true')throw new Error('Demo operations require NODE_ENV=development and DEMO_DATA_ENABLED=true. Production is prohibited.');}
export async function seedDemo(){
  requireDemoEnvironment();const hash=await bcrypt.hash(password(process.env.DEMO_PASSWORD),12);
  return transaction(async session=>{
    const counts={created:0,preserved:0};
    const ensure=async(Model,key,data)=>{const existing=await Model.findOne(key).session(session);if(existing){if(existing.demoBatch!==DEMO_BATCH)throw new Error('Demo identity collides with an existing real record; no changes were committed.');counts.preserved++;return existing;}const record=(await Model.create([{...data,demoBatch:DEMO_BATCH}],{session}))[0];counts.created++;return record;};
    const hostelId='sw-demo-hostel';const staffId='sw-demo-staff';
    await ensure(Hostel,{id:hostelId},{id:hostelId,name:'Development Demo Residence',nameKey:'development demo residence',color:'#4f46e5',rooms:['D101','D102','D103','D104'],active:true});
    await ensure(Schedule,{hostelId},{hostelId,days:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],pickup:'08:00',delivery:'18:00',emergencyEnabled:true,maxWeight:5,extraWeightRate:20,capacity:30,processingHours:24});
    await ensure(User,{id:staffId},{id:staffId,name:'Demo Laundry Staff',email:'staff@smartwash.example',passwordHash:hash,role:'staff',hostelId,counter:'Demo Counter',active:true,verified:true});
    for(let i=1;i<=4;i++){
      const studentId=`sw-demo-student-${i}`,userId=`sw-demo-user-${i}`,orderId=`sw-demo-order-${i}`,laundryId=`LID-demo-${i}`;
      const tags=Array.from({length:4},(_,j)=>({serialNumber:`Tdemo-${i}-${j+1}`,status:'active',garmentName:`Demo shirt ${j+1}`,category:'Shirts'}));
      const student=await ensure(Student,{id:studentId},{id:studentId,name:`Demo Student ${i}`,email:`student${i}@smartwash.example`,hostelId,room:`D10${i}`,laundryId,tags,status:'active'});
      await ensure(User,{id:userId},{id:userId,name:student.name,email:student.email,passwordHash:hash,role:'student',studentId,active:true,verified:true});
      const stage=[0,2,4,5][i-1],status=statuses[stage],now=Date.now();const scannedTags=stage?tags.slice(0,2).map(t=>t.serialNumber):[];
      const history=statuses.slice(0,stage+1).map((state,j)=>({status:state,timestamp:new Date(now-(stage-j)*3600000),note:'Explicit development sample',actorId:j?staffId:userId,station:j?'Demo Counter':undefined}));
      const pricing={maxWeight:5,extraWeightRate:20,currency:'INR'};
      await ensure(Order,{id:orderId},{id:orderId,studentId,studentName:student.name,laundryId,hostelId,room:student.room,clothes:{Shirts:2},expectedTotal:2,scannedTags,status,pickupDate:localDate(),history,...(stage?{weight:6,overLimitCharge:20,pricing,estimatedReadyAt:new Date(now+86400000),pickup:{at:history[1].timestamp,actorId:staffId,station:'Demo Counter',verifiedCount:2},billing:{statementId:`BILL-${orderId}`,issuedAt:history[1].timestamp,currency:'INR',weightKg:6,includedWeightKg:5,extraWeightKg:1,ratePerKg:20,amount:20,paymentStatus:'Not collected'}}:{}),...(stage===5?{delivery:{at:new Date(now),actorId:staffId,station:'Demo Counter',tagSerial:tags[0].serialNumber}}:{})});
      for(const serial of scannedTags)await ensure(ScanEvent,{id:`sw-demo-scan-${i}-${serial}`},{id:`sw-demo-scan-${i}-${serial}`,requestId:orderId,tagSerial:serial,actorId:staffId,station:'Demo Counter',kind:'receive'});
      if(stage===5)await ensure(ScanEvent,{id:'sw-demo-delivery-4'},{id:'sw-demo-delivery-4',requestId:orderId,tagSerial:tags[0].serialNumber,actorId:staffId,station:'Demo Counter',kind:'delivery'});
      await ensure(Notification,{id:`sw-demo-notification-${i}`},{id:`sw-demo-notification-${i}`,targetType:'individual',userId,message:`Development demo: your laundry is ${status.toLowerCase()}.`,readBy:[]});
      await ensure(Audit,{id:`sw-demo-audit-${i}`},{id:`sw-demo-audit-${i}`,actorId:userId,action:'demo.order.created',entityId:orderId,details:{developmentOnly:true}});
    }
    await ensure(Issue,{id:'sw-demo-issue'},{id:'sw-demo-issue',studentId:'sw-demo-student-3',studentName:'Demo Student 3',laundryId:'LID-demo-3',hostelId,requestId:'sw-demo-order-3',type:'Damaged Clothes',description:'Development example: inspect a loose button before handover.',status:'Assigned',assignedTo:staffId});
    return {...counts,batch:DEMO_BATCH};
  });
}
const references=(value,ids)=>{if(typeof value==='string')return ids.has(value);if(Array.isArray(value))return value.some(v=>references(v,ids));if(value&&typeof value==='object'&&!(value instanceof Date))return Object.values(value).some(v=>references(v,ids));return false;};
export async function cleanupDemo({commit=false,confirmation,backupDir}={}){
  requireDemoEnvironment();const database=mongoose.connection.db.databaseName;
  if(commit&&confirmation!==`${database}:${DEMO_BATCH}`)throw new Error('Cleanup confirmation must match database:batch. No records changed.');
  return transaction(async session=>{
    const snapshot={},ids=new Set(),userIds=[];const entries=Object.entries(models);
    for(const[name,Model]of entries){snapshot[name]=await Model.find({demoBatch:DEMO_BATCH}).session(session).lean();for(const r of snapshot[name]){if(r.id)ids.add(r.id);if(name==='User')userIds.push(r.id);}}
    for(const[name,Model]of entries){if(['Session','AuthToken'].includes(name)){snapshot[name]=await Model.find({userId:{$in:userIds}}).session(session).lean();continue;}const others=await Model.find({demoBatch:{$ne:DEMO_BATCH}}).session(session).lean();if(others.some(r=>references(r,ids)))throw new Error(`Cleanup blocked: non-demo ${name} records reference this batch. Preserve/review those records first.`);}
    const counts=Object.fromEntries(entries.map(([name])=>[name,snapshot[name].length]));
    if(!commit)return {dryRun:true,database,batch:DEMO_BATCH,counts};
    if(!backupDir)throw new Error('A backup directory is required for cleanup.');
    const dir=path.resolve(backupDir);await mkdir(dir,{recursive:true,mode:0o700});const file=path.join(dir,`demo-backup-${Date.now()}-${randomUUID()}.json`);const contents=JSON.stringify({database,batch:DEMO_BATCH,createdAt:new Date(),records:snapshot},null,2);
    await writeFile(file,contents,{flag:'wx',mode:0o600});if(digest(await readFile(file))!==digest(contents))throw new Error('Backup verification failed; no deletion occurred.');
    // Only clearly marked records and tokens belonging to marked demo users.
    for(const[name,Model]of entries)await Model.deleteMany(['Session','AuthToken'].includes(name)?{userId:{$in:userIds}}:{demoBatch:DEMO_BATCH},{session});
    return {dryRun:false,database,batch:DEMO_BATCH,counts,backup:file,sha256:digest(contents)};
  });
}
