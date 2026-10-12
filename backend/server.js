import './env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb, disconnectDb, transaction } from './db.js';
import { User, Student, Hostel, Schedule, Order, Issue, Notification, ScanEvent, Audit, Session, AuthToken, plain } from './models.js';
import { newId, secret, digest, fail, text, email, password, number, statuses, validateTransition, validateClothes, parseQr, localDate, weekday, fee } from './domain.js';
export const app = express();
const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
const production = process.env.NODE_ENV === 'production';
const cookie = {httpOnly:true,secure:production,sameSite:'lax',path:'/'};
if (process.env.TRUST_PROXY === '1') app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:'],connectSrc:["'self'",origin],fontSrc:["'self'"],mediaSrc:["'self'",'blob:']}}}));
app.use(cors({origin,credentials:true,exposedHeaders:['X-Next-Page','X-Total-Count']}));
app.use(express.json({limit:'64kb'}));
app.use(cookieParser());
app.use('/api',rateLimit({windowMs:60000,limit:300,message:{message:'Too many requests. Please wait a minute and retry.'},standardHeaders:'draft-8',legacyHeaders:false}));
app.use('/api', (req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== origin) return res.status(403).json({message:'Untrusted request origin'});
  next();
});
const route = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const create = async (Model,data,session) => (await Model.create([data],{session}))[0];
const audit = (session,actorId,action,entityId,details={})=>create(Audit,{id:newId('a'),actorId,action,entityId,details},session);
const notify = (session,userId,message)=>create(Notification,{id:newId('n'),targetType:'individual',userId,message,readBy:[]},session);
const roles = (...allowed)=>(req,res,next)=>allowed.includes(req.user.role)?next():res.status(403).json({message:'This action is not authorized for your role'});
const scope = (user) => user.role==='student'?{studentId:user.studentId}:user.role==='staff'?{hostelId:user.hostelId}:{};
const allowedStudent = (user,student) => {if(!student) fail('Student not found',404); if(user.role==='student'&&student.id!==user.studentId || user.role==='staff'&&student.hostelId!==user.hostelId) fail('Not authorized for this student',403);};
async function list(Model,filter,req,res,sort={createdAt:-1,id:1},view=plain){
  const page=number(req.query.page??1,'Page',1,1000000,true),limit=number(req.query.limit??100,'Page size',1,100,true);
  const total=await Model.countDocuments(filter),items=(await Model.find(filter).sort(sort).skip((page-1)*limit).limit(limit)).map(view);const pages=Math.ceil(total/limit);
  res.set('X-Total-Count',String(total));if(page<pages)res.set('X-Next-Page',String(page+1));
  res.json(req.query.page&&req.query.format!=='array'?{items,page,limit,total,pages}:items);
}
const orderFor = async (req,id,session) => { const order=await Order.findOne({id,...scope(req.user)}).session(session||null);if(!order) fail('Order not found',404);return order;};
const profile = async user => {
  const p=plain(user);
  if(user.role==='student'){const s=await Student.findOne({id:user.studentId});if(!s||s.status!=='active') fail('Account is inactive',403);const h=await Hostel.findOne({id:s.hostelId});const room=h?.roomDetails?.find(r=>r.number===s.room);return {...p,...plain(s),...(room?{floor:room.floor,building:room.building}:{}),userId:user.id,role:user.role};}
  if(user.hostelId){const h=await Hostel.findOne({id:user.hostelId});p.hostelName=h?.name;}
  return p;
};
const issueSession = async (res,user) => {
  const token=secret();const hours=number(process.env.SESSION_HOURS||12,'Session hours',1,72);
  await Session.create({hash:digest(token),userId:user.id,expiresAt:new Date(Date.now()+hours*3600000)});
  res.cookie('sw_session',token,{...cookie,maxAge:hours*3600000});
};
const mailConfigured = ()=>!!(process.env.SMTP_HOST&&process.env.MAIL_FROM);
const sendToken = async (user,kind) => {
  const raw=secret();await AuthToken.create({hash:digest(raw),userId:user.id,kind,expiresAt:new Date(Date.now()+(kind==='reset'?30:1440)*60000)});
  const link=new URL(origin);link.searchParams.set(kind,raw);
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:Number(process.env.SMTP_PORT)===465,
    ...(process.env.SMTP_USER?{auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}}:{})});
  await transport.sendMail({from:process.env.MAIL_FROM,to:user.email,subject:kind==='reset'?'Reset your Smart Wash password':'Verify your Smart Wash account',text:`Open this link: ${link.toString()}\nIf you did not request this, ignore it.`});
};
const authLimit=rateLimit({windowMs:15*60000,limit:30,message:{message:'Too many authentication attempts. Please try again later.'},standardHeaders:'draft-8',legacyHeaders:false});
app.get('/api/health',route(async(req,res)=>res.status(mongoose.connection.readyState===1?200:503).json({status:mongoose.connection.readyState===1?'ready':'unavailable'})));
app.get('/api/auth/config',(req,res)=>res.json({emailEnabled:mailConfigured()}));
app.get('/api/auth/hostels',route(async(req,res)=>res.json((await Hostel.find({active:true}).select('id name rooms')).map(plain))));
app.post('/api/auth/login',authLimit,route(async(req,res)=>{
  const e=email(req.body.email); const user=await User.findOne({email:e,active:true});
  const hash=user?.passwordHash||'$2b$12$C6UzMDM.H6dfI/f/IKcEe.7Ay2zOn.EVoEyiOL14wmKnzTCNOJRkK';
  const ok=typeof req.body.password==='string'&&Buffer.byteLength(req.body.password)<=72&&await bcrypt.compare(req.body.password,hash);
  if(!user||!ok) fail('Invalid email or password',401);
  if(req.body.portal!==undefined){if(!['admin','student','staff'].includes(req.body.portal))fail('Select a valid portal');if(req.body.portal!==user.role)fail('This account belongs to a different portal',403);}
  if(mailConfigured()&&!user.verified) fail('Verify your email before signing in',403);
  const p=await profile(user);await issueSession(res,user);res.json({user:p});
}));
async function addStudent(body,session,actorId=null) {
  const e=email(body.email);const name=text(body.name,'Full name');
  const h=await Hostel.findOne({id:text(body.hostelId,'Hostel'),active:true}).session(session);
  if(!h) fail('Select an active hostel'); await Hostel.updateOne({id:h.id},{$set:{updatedAt:new Date()}},{session}); const room=text(body.room,'Room',30);if(!h.rooms.includes(room)) fail('Room does not belong to selected hostel');await checkRoomCapacity(h,room,null,session);
  if(await User.exists({email:e}).session(session)) fail('Email is already registered',409);
  const roll=body.rollNumber?text(body.rollNumber,'Roll number',50):undefined;
  if(roll&&await Student.exists({rollNumber:roll}).collation({locale:'en',strength:2}).session(session)) fail('Roll number is already registered',409);
  const sid=newId('s');const uid=newId('u');
  const s=await create(Student,{id:sid,name,email:e,rollNumber:roll,rollKey:roll?.toLowerCase(),regNumber:body.regNumber?text(body.regNumber,'Registration number',50):undefined,mobile:body.mobile?text(body.mobile,'Mobile',30):'',hostelId:h.id,room,floor:body.floor?number(body.floor,'Floor',0,100,true):0,
    laundryId:newId('LID-'),tags:Array.from({length:20},()=>({serialNumber:newId('T'),status:'active'})),status:'active'},session);
  const u=await create(User,{id:uid,name,email:e,passwordHash:await bcrypt.hash(password(body.password),12),role:'student',studentId:sid,active:true,verified:!mailConfigured()},session);
  await audit(session,actorId||uid,'student.created',sid);
  return {student:s,user:u};
}
app.post('/api/auth/register',authLimit,route(async(req,res)=>{
  if(req.body.password!==req.body.confirmPassword) fail('Passwords do not match');
  const result=await transaction(s=>addStudent(req.body,s));
  if(mailConfigured()) {try {await sendToken(result.user,'verify');}catch {return res.status(201).json({message:'Account created. Email delivery failed; use Resend verification.',requiresVerification:true});}}
  res.status(201).json({message:mailConfigured()?'Account created. Check your email to verify.':'Account created. Sign in to continue.',requiresVerification:mailConfigured()});
}));
app.post('/api/auth/forgot-password',authLimit,route(async(req,res)=>{
  const e=email(req.body.email);if(!mailConfigured()) fail('Password reset email is not configured. Contact your administrator.',503);
  const user=await User.findOne({email:e,active:true});if(user) {try{await sendToken(user,'reset');}catch{console.error('Reset email delivery failed');}}res.json({message:'If this account exists, password reset email delivery has been requested.'});
}));
app.post('/api/auth/resend-verification',authLimit,route(async(req,res)=>{
  if(!mailConfigured()) fail('Email verification is not configured',503);const e=email(req.body.email);const user=await User.findOne({email:e,active:true,verified:false});if(user) {try{await sendToken(user,'verify');}catch{console.error('Verification email delivery failed');}}res.json({message:'If verification is needed, email delivery has been requested.'});
}));
app.post('/api/auth/reset-password',authLimit,route(async(req,res)=>{
  if(req.body.password!==req.body.confirmPassword) fail('Passwords do not match');const p=password(req.body.password);const hash=digest(text(req.body.token,'Reset token'));
  await transaction(async s=>{const token=await AuthToken.findOneAndDelete({hash,kind:'reset',expiresAt:{$gt:new Date()}},{session:s});if(!token) fail('Reset link is invalid or expired');
    await User.updateOne({id:token.userId},{$set:{passwordHash:await bcrypt.hash(p,12)}},{session:s});await Session.deleteMany({userId:token.userId},{session:s});await AuthToken.deleteMany({userId:token.userId,kind:'reset'},{session:s});await audit(s,token.userId,'password.reset',token.userId);});
  res.clearCookie('sw_session',cookie);res.json({message:'Password reset. Sign in with your new password.'});
}));
app.post('/api/auth/verify-email',authLimit,route(async(req,res)=>{
  await transaction(async s=>{const token=await AuthToken.findOneAndDelete({hash:digest(text(req.body.token,'Verification token')),kind:'verify',expiresAt:{$gt:new Date()}},{session:s});if(!token) fail('Verification link is invalid or expired');await User.updateOne({id:token.userId},{$set:{verified:true}},{session:s});await AuthToken.deleteMany({userId:token.userId,kind:'verify'},{session:s});});res.json({message:'Email verified. You can sign in.'});
}));
app.use('/api',route(async(req,res,next)=>{
  if(mongoose.connection.readyState!==1) fail('Database unavailable',503);
  const token=req.cookies.sw_session;if(!token) fail('Sign in to continue',401);
  const session=await Session.findOne({hash:digest(token),expiresAt:{$gt:new Date()}});if(!session) fail('Session expired. Sign in again.',401);
  const user=await User.findOne({id:session.userId,active:true});if(!user) fail('Account is inactive',401);
  if(user.role==='student'){const student=await Student.findOne({id:user.studentId,status:'active'});if(!student) fail('Account is inactive',401);}
  req.user=user;req.sessionHash=session.hash;
  // Continue the router only after authenticated user is attached.
  req.authenticated=true; next();
}));
// The async authentication middleware must explicitly call next.
app.get('/api/auth/me',route(async(req,res)=>res.json({user:await profile(req.user)})));
app.post('/api/auth/logout',route(async(req,res)=>{await Session.deleteOne({hash:req.sessionHash});res.clearCookie('sw_session',cookie);res.json({message:'Signed out'});}));
app.put('/api/profile',roles('student'),route(async(req,res)=>{
  const name=text(req.body.name,'Full name');const mobile=req.body.mobile?text(req.body.mobile,'Mobile',30):'';
  await transaction(async s=>{await Student.updateOne({id:req.user.studentId},{$set:{name,mobile}},{session:s,runValidators:true});await User.updateOne({id:req.user.id},{$set:{name}},{session:s});await audit(s,req.user.id,'profile.updated',req.user.studentId);});
  res.json({user:await profile(await User.findOne({id:req.user.id}))});
}));

app.post('/api/auth/change-password',authLimit,route(async(req,res)=>{
  const next=password(req.body.password);if(req.body.password!==req.body.confirmPassword)fail('Passwords do not match');
  await transaction(async s=>{const u=await User.findOne({id:req.user.id}).session(s);if(typeof req.body.currentPassword!=='string'||Buffer.byteLength(req.body.currentPassword)>72||!await bcrypt.compare(req.body.currentPassword,u.passwordHash))fail('Current password is incorrect',403);u.passwordHash=await bcrypt.hash(next,12);await u.save({session:s});await Session.deleteMany({userId:u.id},{session:s});await AuthToken.deleteMany({userId:u.id,kind:'reset'},{session:s});await audit(s,u.id,'password.changed',u.id);});res.clearCookie('sw_session',cookie);res.json({message:'Password changed. Sign in again.'});
}));
app.put('/api/students/:id/tags/:serial',roles('student','admin'),route(async(req,res)=>{
  const garmentName=text(req.body.garmentName,'Garment name',100);const category=text(req.body.category,'Garment category');validateClothes({[category]:1});
  const result=await transaction(async s=>{const student=await Student.findOne({id:req.params.id}).session(s);allowedStudent(req.user,student);const tag=student.tags.find(t=>t.serialNumber===req.params.serial&&t.status==='active');if(!tag)fail('Active tag not found',404);if(await Order.exists({studentId:student.id,status:{$nin:['Delivered','Cancelled']},scannedTags:tag.serialNumber}).session(s))fail('Cannot edit a garment while it is being processed',409);tag.garmentName=garmentName;tag.category=category;await student.save({session:s});await audit(s,req.user.id,'garment.updated',student.id,{tag:tag.serialNumber,garmentName,category});return student;});res.json(plain(result));
}));
app.get('/api/pickup-options',roles('student'),route(async(req,res)=>{
  const student=await Student.findOne({id:req.user.studentId});const sched=await Schedule.findOne({hostelId:student.hostelId});if(!sched)fail('Schedule is not configured',409);
  const counts=await Order.aggregate([{$match:{hostelId:student.hostelId,status:{$ne:'Cancelled'},pickupDate:{$gte:localDate()}}},{$group:{_id:'$pickupDate',count:{$sum:1}}}]);
  const today=localDate();const options=Array.from({length:31},(_,i)=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10);const remaining=Math.max(0,sched.capacity-(counts.find(c=>c._id===date)?.count||0));const scheduled=sched.days.includes(weekday(d));return {date,remaining,scheduled,eligible:(scheduled||sched.emergencyEnabled)&&remaining>0};});res.json({today,timeZone:process.env.LAUNDRY_TIMEZONE||'Asia/Kolkata',options});
}));
app.get('/api/requests/:id/billing',route(async(req,res)=>{const o=await orderFor(req,req.params.id);if(!o.billing&&!o.pricing)fail('Weight has not been verified; no statement is available yet',409);res.json({orderId:o.id,studentName:o.studentName,status:o.status,statement:o.billing||{statementId:`BILL-${o.id}`,currency:o.pricing.currency,weightKg:o.weight,includedWeightKg:o.pricing.maxWeight,ratePerKg:o.pricing.extraWeightRate,amount:o.overLimitCharge,paymentStatus:'Not collected'}});}));
app.post('/api/requests/:id/confirm-delivery',roles('student'),route(async(req,res)=>{const o=await transaction(async s=>{const o=await orderFor(req,req.params.id,s);if(o.status!=='Delivered')fail('Delivery has not been recorded',409);if(!o.delivery?.at)fail('This historical order has no delivery verification record',409);if(!o.delivery.studentConfirmedAt){o.delivery.studentConfirmedAt=new Date();await o.save({session:s});await audit(s,req.user.id,'delivery.confirmed',o.id);}return o;});res.json(orderView(o));}));


async function checkRoomCapacity(hostel,room,exclude,session){const limit=hostel.roomDetails?.find(r=>r.number===room)?.capacity;if(limit&&await Student.countDocuments({hostelId:hostel.id,room,status:'active',id:{$ne:exclude}}).session(session)>=limit)fail('Room capacity is full',409);}
app.put('/api/hostels/:id/room-inventory',roles('admin'),route(async(req,res)=>{
  if(!Array.isArray(req.body.rooms)||!req.body.rooms.length||req.body.rooms.length>500)fail('Provide 1–500 rooms');
  const details=req.body.rooms.map(r=>({number:text(r.number,'Room number',30),building:r.building?text(r.building,'Building',100):'',floor:number(r.floor??0,'Floor',0,100,true),...(r.capacity!==undefined&&r.capacity!==''?{capacity:number(r.capacity,'Room capacity',1,100,true)}:{})}));
  if(new Set(details.map(r=>r.number)).size!==details.length)fail('Room numbers must be unique within the hostel');
  const h=await transaction(async s=>{const h=await Hostel.findOne({id:req.params.id}).session(s);if(!h)fail('Hostel not found',404);const rooms=details.map(r=>r.number);if(await Student.exists({hostelId:h.id,room:{$nin:rooms}}).session(s))fail('Cannot remove an assigned room',409);for(const r of details)if(r.capacity&&await Student.countDocuments({hostelId:h.id,room:r.number,status:'active'}).session(s)>r.capacity)fail(`Capacity for room ${r.number} is below its active assignments`,409);h.rooms=rooms;h.roomDetails=details;await h.save({session:s});await audit(s,req.user.id,'rooms.updated',h.id,{rooms:details});return h;});res.json(plain(h));
}));
app.get('/api/activity',route(async(req,res)=>list(Audit,{actorId:req.user.id},req,res)));

app.get('/api/hostels',route(async(req,res)=>res.json((await Hostel.find(req.user.role==='admin'&&req.query.includeInactive==='true'?{}:{active:true})).map(plain))));
app.get('/api/hostels/:id/rooms',route(async(req,res)=>{const h=await Hostel.findOne({id:req.params.id,active:true});if(!h) fail('Hostel not found',404);res.json(h.rooms);}));
async function uniqueHostel(name,id,session){const matches=await Hostel.find({id:{$ne:id}}).select('name').session(session);if(matches.some(h=>h.name.trim().toLowerCase()===name.toLowerCase()))fail('Hostel name already exists',409);}
function hostelInput(body) {
  const name=text(body.name,'Hostel name');const color=text(body.color||'#4f46e5','Color');if(!/^#[0-9a-f]{6}$/i.test(color)) fail('Invalid hostel color');
  if(!Array.isArray(body.rooms)||!body.rooms.length||body.rooms.length>500) fail('Provide 1–500 rooms');const rooms=body.rooms.map(r=>text(r,'Room',30));if(new Set(rooms).size!==rooms.length)fail('Room names must be unique');return {name,nameKey:name.toLowerCase(),color,rooms};
}
app.post('/api/hostels',roles('admin'),route(async(req,res)=>{
  const input=hostelInput(req.body);const h=await transaction(async s=>{await uniqueHostel(input.name,null,s);const h=await create(Hostel,{id:newId('h'),...input},s);await create(Schedule,{hostelId:h.id,days:['Monday'],pickup:'08:00',delivery:'18:00',emergencyEnabled:false,maxWeight:5,extraWeightRate:20,capacity:100,processingHours:24},s);await audit(s,req.user.id,'hostel.created',h.id);return h;});res.status(201).json(plain(h));
}));
app.put('/api/hostels/:id',roles('admin'),route(async(req,res)=>{
  const input=hostelInput(req.body);const h=await transaction(async s=>{const h=await Hostel.findOne({id:req.params.id}).session(s);if(!h) fail('Hostel not found',404);
    if(await Student.exists({hostelId:h.id,room:{$nin:input.rooms}}).session(s)) fail('Cannot remove a room with assigned students',409);
    await uniqueHostel(input.name,h.id,s);if(req.body.active!==undefined){if(typeof req.body.active!=='boolean')fail('Active setting must be boolean');if(!req.body.active)await canArchiveHostel(h.id,s);input.active=req.body.active;}Object.assign(h,input);h.roomDetails=h.roomDetails.filter(r=>input.rooms.includes(r.number));await h.save({session:s});await audit(s,req.user.id,'hostel.updated',h.id);return h;});res.json(plain(h));
}));
async function canArchiveHostel(id,s){if(await Student.exists({hostelId:id,status:'active'}).session(s)||await User.exists({hostelId:id,active:true}).session(s)||await Order.exists({hostelId:id,status:{$nin:['Delivered','Cancelled']}}).session(s))fail('Reassign or deactivate active users and finish orders before archiving',409);}
app.delete('/api/hostels/:id',roles('admin'),route(async(req,res)=>{
  await transaction(async s=>{await canArchiveHostel(req.params.id,s);
    const h=await Hostel.findOneAndUpdate({id:req.params.id,active:true},{$set:{active:false}},{session:s});if(!h) fail('Hostel not found',404);await audit(s,req.user.id,'hostel.archived',h.id);});res.json({message:'Hostel archived. Records retained.'});
}));
app.get('/api/students',roles('admin','staff'),route(async(req,res)=>{
  const hs=await Hostel.find();await list(Student,req.user.role==='staff'?{hostelId:req.user.hostelId}:{},req,res,{createdAt:-1,id:1},s=>{const h=hs.find(h=>h.id===s.hostelId);return {...plain(s),hostelName:h?.name,hostelColor:h?.color};});
}));
app.post('/api/students',roles('admin'),route(async(req,res)=>{const r=await transaction(s=>addStudent(req.body,s,req.user.id));if(mailConfigured()) {try{await sendToken(r.user,'verify');}catch{ /* Admin can retry from the verification form. */ }}res.status(201).json(plain(r.student));}));
app.put('/api/students/:id',roles('admin'),route(async(req,res)=>{
  const result=await transaction(async s=>{const student=await Student.findOne({id:req.params.id}).session(s);if(!student) fail('Student not found',404);
    const name=text(req.body.name??student.name,'Name');const hostelId=req.body.hostelId??student.hostelId;const room=req.body.room??student.room;const h=await Hostel.findOne({id:hostelId,active:true}).session(s);if(!h||!h.rooms.includes(room)) fail('Invalid hostel or room');
    await Hostel.updateOne({id:h.id},{$set:{updatedAt:new Date()}},{session:s});await checkRoomCapacity(h,room,student.id,s);
    if((hostelId!==student.hostelId||room!==student.room)&&await Order.exists({studentId:student.id,status:{$nin:['Delivered','Cancelled']}}).session(s)) fail('Cannot reassign a student with an active order',409);
    const mobile=req.body.mobile===undefined?student.mobile:req.body.mobile?text(req.body.mobile,'Mobile',30):'';const roll=req.body.rollNumber===undefined?student.rollNumber:req.body.rollNumber?text(req.body.rollNumber,'Roll number',50):undefined;
    if(roll&&await Student.exists({id:{$ne:student.id},rollNumber:roll}).collation({locale:'en',strength:2}).session(s))fail('Roll number is already registered',409);
    Object.assign(student,{name,hostelId,room,mobile,rollNumber:roll,rollKey:roll?.toLowerCase(),regNumber:req.body.regNumber===undefined?student.regNumber:req.body.regNumber?text(req.body.regNumber,'Registration number',50):''});await student.save({session:s});await User.updateOne({studentId:student.id},{$set:{name}},{session:s});await audit(s,req.user.id,'student.updated',student.id);return student;});res.json(plain(result));
}));
app.post('/api/students/:id/toggle-status',roles('admin'),route(async(req,res)=>{
  const student=await transaction(async s=>{const student=await Student.findOne({id:req.params.id}).session(s);if(!student) fail('Student not found',404);if(student.status==='inactive'){const h=await Hostel.findOne({id:student.hostelId,active:true}).session(s);if(!h)fail('Reassign to an active hostel before activation',409);await Hostel.updateOne({id:h.id},{$set:{updatedAt:new Date()}},{session:s});await checkRoomCapacity(h,student.room,student.id,s);}student.status=student.status==='active'?'inactive':'active';await student.save({session:s});const u=await User.findOne({studentId:student.id}).session(s);if(u) await Session.deleteMany({userId:u.id},{session:s});await audit(s,req.user.id,'student.status',student.id,{status:student.status});return student;});res.json(plain(student));
}));
app.post('/api/students/:id/replace-tag',roles('admin'),route(async(req,res)=>{
  const old=text(req.body.oldTagSerial,'Old tag');if(!['lost','damaged'].includes(req.body.reason)) fail('Reason must be lost or damaged');
  const result=await transaction(async s=>{const student=await Student.findOne({id:req.params.id}).session(s);if(!student) fail('Student not found',404);const tag=student.tags.find(t=>t.serialNumber===old);if(!tag||tag.status!=='active') fail('An active tag is required');
    if(await Order.exists({studentId:student.id,status:{$nin:['Delivered','Cancelled']},scannedTags:old}).session(s)) fail('Tag is attached to an active order. Resolve the order before replacement.',409);
    tag.status=req.body.reason;const serial=newId('T');student.tags.push({serialNumber:serial,status:'active',garmentName:tag.garmentName,category:tag.category});await student.save({session:s});await audit(s,req.user.id,'tag.replaced',student.id,{oldTag:old,newTag:serial,reason:req.body.reason});return {newTag:serial,tags:student.tags};});res.json({message:'Tag replaced',...result});
}));
app.post('/api/students/:id/disable-tag',roles('admin'),route(async(req,res)=>{
  const serial=text(req.body.tagSerial,'Tag serial');const tags=await transaction(async s=>{const student=await Student.findOne({id:req.params.id}).session(s);if(!student) fail('Student not found',404);const tag=student.tags.find(t=>t.serialNumber===serial);if(!tag||!['active','disabled'].includes(tag.status)) fail('Lost or damaged tags cannot be reactivated');
    if(await Order.exists({studentId:student.id,status:{$nin:['Delivered','Cancelled']},scannedTags:serial}).session(s)) fail('Tag is attached to an active order',409);
    tag.status=tag.status==='active'?'disabled':'active';await student.save({session:s});await audit(s,req.user.id,'tag.status',student.id,{serial,status:tag.status});return student.tags;});res.json({message:'Tag status updated',tags});
}));
app.get('/api/staff',roles('admin'),route(async(req,res)=>{const hs=await Hostel.find();await list(User,{role:'staff'},req,res,{createdAt:-1,id:1},u=>{const h=hs.find(h=>h.id===u.hostelId);return {...plain(u),hostelName:h?.name,hostelColor:h?.color};});}));
app.post('/api/staff',roles('admin'),route(async(req,res)=>{
  const input={name:text(req.body.name,'Name'),email:email(req.body.email),hostelId:text(req.body.hostelId,'Hostel'),counter:text(req.body.counter||'Main Counter','Counter')};const p=password(req.body.password);
  const u=await transaction(async s=>{if(!await Hostel.exists({id:input.hostelId,active:true}).session(s)) fail('Invalid hostel');const u=await create(User,{id:newId('u'),...input,passwordHash:await bcrypt.hash(p,12),role:'staff',active:true,verified:true},s);await audit(s,req.user.id,'staff.created',u.id);return u;});res.status(201).json(plain(u));
}));
app.put('/api/staff/:id',roles('admin'),route(async(req,res)=>{
  const u=await transaction(async s=>{const u=await User.findOne({id:req.params.id,role:'staff'}).session(s);if(!u) fail('Staff not found',404);u.name=text(req.body.name??u.name,'Name');u.counter=text(req.body.counter??u.counter,'Counter');const h=req.body.hostelId??u.hostelId;if(!await Hostel.exists({id:h,active:true}).session(s)) fail('Invalid hostel');u.hostelId=h;if(req.body.active!==undefined){if(typeof req.body.active!=='boolean')fail('Active setting must be boolean');u.active=req.body.active;}if(req.body.password)u.passwordHash=await bcrypt.hash(password(req.body.password),12);await u.save({session:s});await Session.deleteMany({userId:u.id},{session:s});await audit(s,req.user.id,'staff.updated',u.id);return u;});res.json(plain(u));
}));
app.delete('/api/staff/:id',roles('admin'),route(async(req,res)=>{await transaction(async s=>{const u=await User.findOneAndUpdate({id:req.params.id,role:'staff'},{$set:{active:false}},{session:s});if(!u) fail('Staff not found',404);await Session.deleteMany({userId:u.id},{session:s});await audit(s,req.user.id,'staff.archived',u.id);});res.json({message:'Staff access revoked; history retained.'});}));
app.get('/api/schedules',route(async(req,res)=>res.json((await Schedule.find(req.user.role==='staff'?{hostelId:req.user.hostelId}:{})).map(plain))));
app.post('/api/schedules',roles('admin'),route(async(req,res)=>{
  const b=req.body;const hostelId=text(b.hostelId,'Hostel');const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  if(!Array.isArray(b.days)||b.days.length<1||b.days.some(d=>!days.includes(d))) fail('Choose valid laundry days');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.pickup)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.delivery)) fail('Use valid HH:mm times');
  if(b.pickup>=b.delivery)fail('Delivery must be later than pickup on the same day');
  if(typeof b.emergencyEnabled!=='boolean') fail('Emergency setting must be boolean');
  const data={days:[...new Set(b.days)],pickup:b.pickup,delivery:b.delivery,emergencyEnabled:b.emergencyEnabled,maxWeight:number(b.maxWeight,'Weight limit',0.1,100),extraWeightRate:number(b.extraWeightRate,'Extra rate',0,10000)};
  await transaction(async s=>{if(!await Hostel.exists({id:hostelId,active:true}).session(s)) fail('Invalid hostel');const old=await Schedule.findOne({hostelId}).session(s);data.capacity=number(b.capacity??old?.capacity??100,'Capacity',1,10000,true);data.processingHours=number(b.processingHours??old?.processingHours??24,'Processing hours',1,336);await Schedule.updateOne({hostelId},{$set:data},{upsert:true,runValidators:true,session:s});await audit(s,req.user.id,'schedule.updated',hostelId,data);});res.json({message:'Schedule updated'});
}));
app.post('/api/requests',roles('student'),route(async(req,res)=>{
  if(req.body.studentId&&req.body.studentId!==req.user.studentId) fail('Cannot create another student’s order',403);const c=validateClothes(req.body.clothes);
  const date=req.body.pickupDate||localDate();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date<localDate()||date>localDate(new Date(Date.now()+30*86400000))) fail('Pickup date must be within the next 30 days');
  const o=await transaction(async s=>{const student=await Student.findOne({id:req.user.studentId,status:'active'}).session(s);if(!student) fail('Student account unavailable',403);if(!await Hostel.exists({id:student.hostelId,active:true}).session(s))fail('Hostel is inactive',409);
    await Student.updateOne({id:student.id},{$set:{updatedAt:new Date()}},{session:s});
    if(await Order.exists({studentId:student.id,status:{$nin:['Delivered','Cancelled']}}).session(s)) fail('You already have an active laundry request',409);
    const sched=await Schedule.findOne({hostelId:student.hostelId}).session(s);if(!sched) fail('Hostel schedule is not configured',409);
    if(!sched.days.includes(weekday(new Date(date+'T12:00:00Z')))&&!sched.emergencyEnabled) fail('Selected date is not a scheduled laundry day');
    // Write the schedule to serialize competing capacity reservations in this transaction.
    await Schedule.updateOne({hostelId:student.hostelId},{$set:{updatedAt:new Date()}},{session:s});
    if(await Order.countDocuments({hostelId:student.hostelId,pickupDate:date,status:{$ne:'Cancelled'}}).session(s)>=sched.capacity) fail('Pickup capacity is full. Choose another date.',409);
    if(c.total>student.tags.filter(t=>t.status==='active').length) fail('Not enough active garment tags');
    const o=await create(Order,{id:newId('r'),studentId:student.id,studentName:student.name,laundryId:student.laundryId,hostelId:student.hostelId,room:student.room,clothes:c.clothes,expectedTotal:c.total,scannedTags:[],status:statuses[0],issue:null,pickupDate:date,
      history:[{status:statuses[0],timestamp:new Date(),note:'Request submitted by student',actorId:req.user.id}]},s);
    await audit(s,req.user.id,'order.created',o.id);await notify(s,req.user.id,`Laundry request ${o.id} booked for ${date}.`);return o;});res.status(201).json(plain(o));
}));
const orderView=o=>({...plain(o),overdue:!!(o.estimatedReadyAt&&o.estimatedReadyAt<new Date()&&!['Ready','Delivered','Cancelled'].includes(o.status))});
app.get('/api/requests/student/:studentId',route(async(req,res)=>{if(req.user.role==='student'&&req.params.studentId!==req.user.studentId) fail('Not authorized',403);await list(Order,{studentId:req.params.studentId,...scope(req.user)},req,res,{createdAt:-1,id:1},orderView);}));
app.get('/api/requests/staff/:hostelId',roles('staff','admin'),route(async(req,res)=>{if(req.user.role==='staff'&&req.params.hostelId!==req.user.hostelId) fail('Not authorized for this hostel',403);await list(Order,{hostelId:req.params.hostelId,...(req.query.history==='true'?{}:{status:{$nin:['Delivered','Cancelled']}})},req,res,{createdAt:1,id:1},orderView);}));
app.get('/api/requests',roles('admin'),route(async(req,res)=>{const hs=await Hostel.find();const filter={};if(req.query.hostelId)filter.hostelId=String(req.query.hostelId);if(req.query.status)filter.status=String(req.query.status);await list(Order,filter,req,res,{createdAt:-1,id:1},o=>{const h=hs.find(h=>h.id===o.hostelId);return {...orderView(o),hostelName:h?.name,hostelColor:h?.color};});}));
async function receiveScan(req,session,first) {
  const qr=parseQr(req.body.payload,!first);const student=await Student.findOne({laundryId:qr.laundryId,status:'active'}).session(session);allowedStudent(req.user,student);
  const o=first?await Order.findOne({studentId:student.id,status:statuses[0],...scope(req.user)}).session(session):await orderFor(req,req.body.requestId,session);
  if(!o) fail('No order awaiting verification',404);if(o.status!==statuses[0]) fail('Order is no longer awaiting verification',409);if(o.studentId!==student.id) fail('Tag belongs to another student');
  if(o.pickupDate&&o.pickupDate>localDate()) fail('Pickup date has not arrived',409);
  let duplicate=false;
  if(qr.tagSerial){const tag=student.tags.find(t=>t.serialNumber===qr.tagSerial&&t.status==='active');if(!tag) fail('Tag is invalid, lost or disabled');if(tag.category&&!o.scannedTags.includes(qr.tagSerial)){const verified=o.scannedTags.filter(serial=>student.tags.find(t=>t.serialNumber===serial)?.category===tag.category).length;if(verified>=(o.clothes.get(tag.category)||0))fail('Garment category does not match the declared request');}duplicate=o.scannedTags.includes(qr.tagSerial);
    if(!duplicate){if(o.scannedTags.length>=o.expectedTotal) fail('All expected tags have been verified',409);o.scannedTags.push(qr.tagSerial);await o.save({session});await create(ScanEvent,{id:newId('scan'),requestId:o.id,tagSerial:qr.tagSerial,actorId:req.user.id,station:req.user.counter||'Manual',kind:'receive'},session);await audit(session,req.user.id,'tag.scanned',o.id,{tag:qr.tagSerial,station:req.user.counter});}}
  return {request:plain(o),student:plain(student),duplicate,message:duplicate?'Tag already verified; count unchanged':'Tag verified'};
}
app.post('/api/requests/scan-first',roles('staff','admin'),route(async(req,res)=>res.json(await transaction(s=>receiveScan(req,s,true)))));
app.post('/api/requests/scan-tag',roles('staff','admin'),route(async(req,res)=>res.json(await transaction(s=>receiveScan(req,s,false)))));
async function moveOrder(req,o,next,session,note='') {
  validateTransition(o.status,next);
  if(next==='Delivered') fail('Use a verified garment tag to deliver the order');
  if(next==='Received'){
    if(o.scannedTags.length!==o.expectedTotal) fail('Verified count must match declared count',409);o.weight=number(req.body.weight,'Measured weight',0.1,100);
    const sched=await Schedule.findOne({hostelId:o.hostelId}).session(session);if(!sched) fail('Schedule unavailable',409);
    o.overLimitCharge=fee(o.weight,sched);o.pricing={maxWeight:sched.maxWeight,extraWeightRate:sched.extraWeightRate,currency:'INR'};o.pickup={at:new Date(),actorId:req.user.id,station:req.user.counter||'Manual',verifiedCount:o.scannedTags.length};o.billing={statementId:`BILL-${o.id}`,issuedAt:new Date(),currency:'INR',weightKg:o.weight,includedWeightKg:sched.maxWeight,extraWeightKg:Math.max(0,Math.round((o.weight-sched.maxWeight)*100)/100),ratePerKg:sched.extraWeightRate,amount:o.overLimitCharge,paymentStatus:'Not collected'};o.estimatedReadyAt=new Date(Date.now()+sched.processingHours*3600000);
  }
  o.status=next;o.history.push({status:next,timestamp:new Date(),note:note||`Status updated to ${next}`,actorId:req.user.id,station:req.user.counter});await o.save({session});await audit(session,req.user.id,'order.status',o.id,{status:next});const u=await User.findOne({studentId:o.studentId}).session(session);if(u) await notify(session,u.id,`Your laundry is now ${next.toLowerCase()}.`);return o;
}
app.post('/api/requests/:id/status',roles('staff','admin'),route(async(req,res)=>{const next=text(req.body.status,'Status');if(next==='Cancelled')fail('Use cancellation endpoint');const o=await transaction(async s=>moveOrder(req,await orderFor(req,req.params.id,s),next,s,req.body.note?text(req.body.note,'Note',1000):''));res.json(orderView(o));}));
app.post('/api/requests/:id/cancel',roles('student','admin'),route(async(req,res)=>{const o=await transaction(async s=>moveOrder(req,await orderFor(req,req.params.id,s),'Cancelled',s,'Cancelled before receiving'));res.json(orderView(o));}));
app.post('/api/requests/scan-delivery',roles('staff','admin'),route(async(req,res)=>{
  const qr=parseQr(req.body.payload,true);const o=await transaction(async s=>{
    const student=await Student.findOne({laundryId:qr.laundryId}).session(s);allowedStudent(req.user,student);
    const o=await Order.findOne({studentId:student.id,status:'Ready',...scope(req.user)}).session(s);if(!o) fail('No ready order for this student',404);
    if(!o.scannedTags.includes(qr.tagSerial)||!student.tags.some(t=>t.serialNumber===qr.tagSerial&&t.status==='active')) fail('Delivery requires an active tag recorded on this order');
    if(await Issue.exists({requestId:o.id,status:{$ne:'Resolved'}}).session(s)) fail('Resolve open incidents before delivery',409);
    o.delivery={at:new Date(),actorId:req.user.id,station:req.user.counter||'Manual',tagSerial:qr.tagSerial};o.status='Delivered';o.history.push({status:'Delivered',timestamp:new Date(),note:'Collection verified with garment tag',actorId:req.user.id,station:req.user.counter});await o.save({session:s});
    await create(ScanEvent,{id:newId('scan'),requestId:o.id,tagSerial:qr.tagSerial,actorId:req.user.id,station:req.user.counter,kind:'delivery'},s);await audit(s,req.user.id,'order.delivered',o.id,{tag:qr.tagSerial});const u=await User.findOne({studentId:student.id}).session(s);if(u)await notify(s,u.id,'Your laundry was delivered. Thank you!');return o;
  });res.json({message:'Laundry delivered',request:orderView(o)});
}));
app.get('/api/issues',route(async(req,res)=>list(Issue,scope(req.user),req,res)));
app.post('/api/issues',route(async(req,res)=>{
  const description=text(req.body.description,'Description',2000);const type=text(req.body.type,'Issue type',100);const sid=req.body.studentId||req.user.studentId;
  const i=await transaction(async s=>{const student=await Student.findOne({id:sid}).session(s);allowedStudent(req.user,student);
    const o=req.body.requestId?await orderFor(req,req.body.requestId,s):null;if(o&&o.studentId!==sid) fail('Complaint must refer to this student’s order');
    const i=await create(Issue,{id:newId('iss'),studentId:sid,studentName:student.name,laundryId:student.laundryId,hostelId:student.hostelId,requestId:o?.id,type,description,status:'Pending'},s);
    if(o){o.issue={type,description};o.history.push({status:o.status,timestamp:new Date(),note:`Incident reported: ${type}`,actorId:req.user.id});await o.save({session:s});}
    await audit(s,req.user.id,'issue.created',i.id);return i;});res.status(201).json(plain(i));
}));
app.post('/api/issues/:id/assign',roles('admin'),route(async(req,res)=>{
  const i=await transaction(async s=>{const i=await Issue.findOne({id:req.params.id}).session(s);if(!i)fail('Issue not found',404);if(i.status==='Resolved') fail('Issue is already resolved',409);const u=await User.findOne({id:req.body.staffId,role:'staff',active:true,hostelId:i.hostelId}).session(s);if(!u)fail('Assign a staff member in this hostel');i.assignedTo=u.id;i.status='Assigned';await i.save({session:s});await notify(s,u.id,`Complaint assigned: ${i.type}`);await audit(s,req.user.id,'issue.assigned',i.id,{staffId:u.id});return i;});res.json(plain(i));
}));
app.post('/api/issues/:id/resolve',roles('staff','admin'),route(async(req,res)=>{
  const resolution=text(req.body.resolution,'Resolution',2000);const i=await transaction(async s=>{const i=await Issue.findOne({id:req.params.id,...scope(req.user)}).session(s);if(!i)fail('Issue not found',404);if(i.status==='Resolved')fail('Issue is already resolved',409);if(req.user.role==='staff'&&i.assignedTo!==req.user.id)fail('Only assigned staff can resolve this issue',403);
    i.status='Resolved';i.resolution=resolution;i.resolvedAt=new Date();await i.save({session:s});if(i.requestId){const pending=await Issue.findOne({requestId:i.requestId,status:{$ne:'Resolved'}}).session(s);await Order.updateOne({id:i.requestId},{$set:{issue:pending?{type:pending.type,description:pending.description}:null}},{session:s});}
    await audit(s,req.user.id,'issue.resolved',i.id,{resolution});const u=await User.findOne({studentId:i.studentId}).session(s);if(u)await notify(s,u.id,`Complaint resolved: ${resolution}`);return i;});res.json(plain(i));
}));
const notificationScope=user=>({$or:[{targetType:'all'},{targetType:'individual',userId:user.id},...(user.hostelId?[{targetType:'hostel',hostelId:user.hostelId}]:[])]});
app.get('/api/notifications',route(async(req,res)=>{const user={id:req.user.id,hostelId:req.user.hostelId};if(req.user.studentId)user.hostelId=(await Student.findOne({id:req.user.studentId}))?.hostelId;res.json((await Notification.find(notificationScope(user)).sort({createdAt:-1}).limit(100)).map(n=>{const p=plain(n);delete p.readBy;return {...p,read:n.readBy.includes(user.id)};}));}));
app.post('/api/notifications/:id/read',route(async(req,res)=>{const user={id:req.user.id,hostelId:req.user.hostelId};if(req.user.studentId)user.hostelId=(await Student.findOne({id:req.user.studentId}))?.hostelId;const n=await Notification.findOneAndUpdate({id:req.params.id,...notificationScope(user)},{$addToSet:{readBy:user.id}},{returnDocument:'after'});if(!n)fail('Notification not found',404);res.json({read:true});}));
app.post('/api/notifications',roles('admin'),route(async(req,res)=>{
  const targetType=text(req.body.targetType,'Target');if(!['all','hostel','individual'].includes(targetType))fail('Invalid target');const data={id:newId('n'),targetType,message:text(req.body.message,'Message',1000)};
  if(targetType==='hostel'){if(!await Hostel.exists({id:req.body.hostelId,active:true}))fail('Invalid hostel');data.hostelId=req.body.hostelId;}
  if(targetType==='individual'){if(!await User.exists({id:req.body.userId,active:true}))fail('Invalid user');data.userId=req.body.userId;}
  const n=await transaction(async s=>{const n=await create(Notification,data,s);await audit(s,req.user.id,'notification.created',n.id);return n;});res.status(201).json(plain(n));
}));
app.get('/api/audit',roles('admin'),route(async(req,res)=>list(Audit,{},req,res)));
app.get('/api/requests/:id/events',route(async(req,res)=>{const o=await orderFor(req,req.params.id);res.json({history:plain(o).history,scans:(await ScanEvent.find({requestId:o.id}).sort({createdAt:1})).map(plain)});}));
app.get('/api/dashboard/admin',roles('admin'),route(async(req,res)=>{
  const match={};if(req.query.hostelId)match.hostelId=String(req.query.hostelId);if(req.query.status)match.status=String(req.query.status);
  if(req.query.from||req.query.to){match.createdAt={};for(const key of ['from','to'])if(req.query[key]){const date=new Date(String(req.query[key])+(key==='to'?'T23:59:59.999Z':'T00:00:00Z'));if(Number.isNaN(date.getTime()))fail('Invalid date filter');match.createdAt[key==='from'?'$gte':'$lte']=date;}}
  const hs=await Hostel.find({active:true});const grouped=await Order.aggregate([{$match:match},{$group:{_id:'$status',count:{$sum:1}}}]);
  const today=localDate();const requests=await Order.find(match);const todayOrders=requests.filter(o=>localDate(o.createdAt)===today);
  const pendingRequests=grouped.filter(g=>!['Delivered','Cancelled'].includes(g._id)).reduce((a,b)=>a+b.count,0);
  const weighted=requests.filter(o=>o.weight!==undefined);const dailyCounts=Array.from({length:7},(_,i)=>{const date=new Date(Date.now()-(6-i)*86400000);const key=localDate(date);return {date:key,label:weekday(date).slice(0,3),count:requests.filter(o=>localDate(o.createdAt)===key).length};});
  res.json({totalHostels:hs.length,totalStudents:await Student.countDocuments({status:'active'}),totalStaff:await User.countDocuments({role:'staff',active:true}),todayRequestsCount:todayOrders.length,pendingRequests,completedRequests:grouped.find(g=>g._id==='Delivered')?.count||0,
    totalWeightToday:Math.round(todayOrders.reduce((sum,o)=>sum+(o.weight||0),0)*10)/10,averageBagWeight:weighted.length?Math.round(weighted.reduce((sum,o)=>sum+o.weight,0)/weighted.length*10)/10:0,
    hostelStats:hs.map(h=>({name:h.name,count:requests.filter(o=>o.hostelId===h.id).length,color:h.color})),dailyCounts,statusCounts:grouped.map(g=>({status:g._id,count:g.count})),overdueCount:requests.filter(o=>orderView(o).overdue).length,
    recentActivities:requests.flatMap(o=>o.history.map(h=>({...h.toObject(),studentName:o.studentName,laundryId:o.laundryId}))).sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).slice(0,8)});
}));
app.use('/api',(req,res)=>res.status(404).json({message:'API endpoint not found'}));
if(production){const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../frontend/dist');app.use(express.static(dist));app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));}
app.use((err,req,res,next)=>{
  if(res.headersSent)return next(err);
  const status=err.status|| (err.code===11000?409:err.name==='ValidationError'||err.name==='CastError'?400:500);
  const message=err.type==='entity.parse.failed'?'Invalid JSON request body':err.code===11000?'Record already exists. Check email, tags, or active orders.':err.expose||status<500?err.message:'Service unavailable. Please retry or contact your administrator.';
  if(status>=500&&!err.expose)console.error('Request failed:',err.name,err.code||'');res.status(status).json({message});
});
export async function start(){await connectDb();const server=app.listen(Number(process.env.PORT||5000),()=>console.log('Smart Wash API ready'));
  let closing=false;const shutdown=()=>{if(closing)return;closing=true;server.close(async()=>{await disconnectDb();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();};process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);return server;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){start().catch(async err=>{console.error('Startup failed:',err.message.replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g,'[database URI]'));await disconnectDb();process.exitCode=1;});}
