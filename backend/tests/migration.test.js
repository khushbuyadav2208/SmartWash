import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import {connectDb,disconnectDb} from '../db.js';
import {User,Hostel} from '../models.js';
const exec=promisify(execFile);
test('migration dry-run, verified backups, idempotence and transactional conflict handling',async t=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'smartwash-import-test-'));const source=path.join(folder,'legacy.json');
  const script=fileURLToPath(new URL('../migrate.js',import.meta.url));let mongo;
  const data={users:[{id:'legacy-admin',email:'admin@migration.test',name:'Legacy Administrator',role:'admin',password:'LegacyPassword123!'}],hostels:[{id:'legacy-hostel',name:'Legacy Residence',color:'#4f46e5'}],rooms:{'legacy-hostel':['101']},students:[],requests:[],issues:[],notifications:[],schedules:[{hostelId:'legacy-hostel',days:['Monday'],pickup:'08:00',delivery:'18:00',emergencyEnabled:false}]};
  try {
    const original=JSON.stringify(data);await fs.writeFile(source,original);
    await t.test('dry-run requires no connection and leaves source untouched',async()=>{const r=await exec(process.execPath,[script,'--source='+source],{cwd:folder,env:{...process.env,MONGODB_URI:''}});assert.ok(r.stdout.includes('dry-run'));assert.equal(await fs.readFile(source,'utf8'),original);assert.equal((await fs.readdir(folder)).length,1);});
    mongo=await MongoMemoryReplSet.create({replSet:{count:1,args:['--nounixsocket']},binary:{version:'7.0.24'}});const uri=mongo.getUri('migration_test');await connectDb(uri);
    const run=()=>exec(process.execPath,[script,'--source='+source,'--commit'],{cwd:folder,env:{...process.env,MONGODB_URI:uri}});
    await t.test('commit verifies backup and hashes legacy password',async()=>{const r=await run();assert.ok(r.stdout.includes('"inserted":3'));const u=await User.findOne({id:'legacy-admin'});assert.ok(u.passwordHash.startsWith('$2'));assert.equal(u.password,undefined);const backups=await fs.readdir(path.join(folder,'backups'));const b=backups.find(n=>n.startsWith('legacy-'));assert.equal(await fs.readFile(path.join(folder,'backups',b),'utf8'),original);assert.ok(backups.some(n=>n.startsWith('mongodb-before-')));});
    await t.test('rerun skips existing records without overwriting',async()=>{const hash=(await User.findOne()).passwordHash;const r=await run();assert.ok(r.stdout.includes('"skipped":3'));assert.equal((await User.findOne()).passwordHash,hash);});
    await t.test('conflicting identity rolls back all new inserts',async()=>{const changed=structuredClone(data);changed.users[0].email='different@migration.test';changed.hostels.push({id:'new-hostel',name:'Must roll back'});changed.rooms['new-hostel']=['101'];await fs.writeFile(source,JSON.stringify(changed));await assert.rejects(run,e=>e.stderr.includes('Conflicting existing User'));assert.equal(await Hostel.countDocuments({id:'new-hostel'}),0);assert.equal((await User.findOne()).email,'admin@migration.test');});
  }finally{await disconnectDb();if(mongo)await mongo.stop();await fs.rm(folder,{recursive:true,force:true});}
});
test('mandatory database URI rejects absent configuration',async()=>{await assert.rejects(()=>connectDb(''),/MONGODB_URI is required/);});
