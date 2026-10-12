// Isolated end-to-end runner: never connects to MONGODB_URI or user data.
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import bcrypt from 'bcryptjs';
import {connectDb,disconnectDb} from './db.js';
import {User,Hostel,Schedule} from './models.js';
process.env.APP_ORIGIN='http://127.0.0.1:5173';process.env.NODE_ENV='test';process.env.SMTP_HOST='';process.env.MAIL_FROM='';
const {app}=await import('./server.js');
// Refuse to drive a browser against an already running operator application.
for(const port of [5000,5173])await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',()=>reject(new Error(`Port ${port} is in use. Stop the local app before isolated browser tests.`)));probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});
const mongo=await MongoMemoryReplSet.create({replSet:{count:1,args:['--nounixsocket']},binary:{version:'7.0.24'}});
let api,vite;
try{
  await connectDb(mongo.getUri('smart_wash_browser_test'));
  const hash=await bcrypt.hash('ValidPassword123!',12);
  await User.create([{id:'qa-admin',name:'QA Admin',email:'admin@qa.test',role:'admin',passwordHash:hash,verified:true},{id:'qa-staff',name:'QA Staff',email:'staff@qa.test',role:'staff',passwordHash:hash,hostelId:'qa-hostel',counter:'QA Desk',verified:true}]);
  await Hostel.create({id:'qa-hostel',name:'QA Residence',rooms:['101','102'],color:'#4f46e5'});
  await Schedule.create({hostelId:'qa-hostel',days:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],pickup:'08:00',delivery:'18:00',emergencyEnabled:true,maxWeight:5,extraWeightRate:20,capacity:100,processingHours:24});
  api=await new Promise((resolve,reject)=>{const server=app.listen(5000,'127.0.0.1',()=>resolve(server));server.once('error',reject);});
  vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{cwd:new URL('../frontend/',import.meta.url),stdio:'inherit'});
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5173')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const code=await new Promise(resolve=>{const child=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test'],{cwd:new URL('../frontend/',import.meta.url),stdio:'inherit'});child.on('exit',resolve);});process.exitCode=code||0;
}finally{vite?.kill();if(api)await new Promise(r=>api.close(r));await disconnectDb();await mongo.stop();}
