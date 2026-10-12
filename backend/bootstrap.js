import './env.js';
import mongoose from 'mongoose';
import {seedDemo,cleanupDemo,requireDemoEnvironment} from './demo.js';
import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb, transaction } from './db.js';
import { User, Hostel, Schedule, Audit } from './models.js';
import { email, password, newId } from './domain.js';
try {
  const demo=process.argv.includes('--demo'),cleanup=process.argv.includes('--cleanup-demo');
  if(demo||cleanup){requireDemoEnvironment();await connectDb();const database=mongoose.connection.db.databaseName;const argument=prefix=>process.argv.find(a=>a.startsWith(prefix))?.slice(prefix.length);if(argument('--database=')!==database)throw new Error('Pass --database=<exact database name> to acknowledge the development target.');
    const result=demo?await seedDemo():await cleanupDemo({commit:process.argv.includes('--commit'),confirmation:argument('--confirm='),backupDir:argument('--backup-dir=')});console.log(JSON.stringify(result,null,2));
  }else{
  const e=email(process.env.ADMIN_EMAIL);const p=password(process.env.ADMIN_PASSWORD);await connectDb();
  await transaction(async session=>{
    if(await User.exists({email:e}).session(session))throw new Error('Account already exists. Bootstrap never overwrites an account.');
    const id=newId('u');await User.create([{id,name:process.env.ADMIN_NAME||'System Admin',email:e,passwordHash:await bcrypt.hash(p,12),role:'admin',active:true,verified:true}],{session});
    if(process.argv.includes('--demo-hostel')){requireDemoEnvironment();const h=newId('h');await Hostel.create([{id:h,name:'Demo Residence',color:'#4f46e5',rooms:['101','102'],active:true}],{session});await Schedule.create([{hostelId:h,days:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],pickup:'08:00',delivery:'18:00',emergencyEnabled:true,maxWeight:5,extraWeightRate:20,capacity:100,processingHours:24}],{session});}
    await Audit.create([{id:newId('a'),actorId:id,action:'admin.bootstrapped'}],{session});
  });console.log('Administrator created. No existing records changed.');
  }
}catch(e){console.error('Bootstrap failed:',e.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[database URI]'));process.exitCode=1;}finally{await disconnectDb();}
