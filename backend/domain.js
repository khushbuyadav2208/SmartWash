import { randomUUID, createHash, randomBytes } from 'node:crypto';
export const newId = (prefix='') => prefix + randomUUID();
export const secret = () => randomBytes(32).toString('hex');
export const digest = value => createHash('sha256').update(value).digest('hex');
export function fail(message, status=400) { const err = new Error(message); err.status = status; err.expose = true; throw err; }
export function text(value, name, max=200) { if(typeof value !== 'string' || !value.trim() || value.length > max) fail(`${name} is required (maximum ${max} characters)`); return value.trim(); }
export function email(value) { const e=text(value,'Email').toLowerCase(); if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) fail('Enter a valid email'); return e; }
export function password(value) { if(typeof value!=='string'||value.length<12||Buffer.byteLength(value)>72||!/[a-z]/.test(value)||!/[A-Z]/.test(value)||!/[0-9]/.test(value)) fail('Password must contain 12–72 bytes, uppercase, lowercase and a number'); return value; }
export function number(value,name,min,max,integer=false) { if(value === '' || value == null || !['number','string'].includes(typeof value)) fail(`${name} is required`); const n=Number(value); if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n))) fail(`${name} must be ${integer?'an integer':'a number'} from ${min} to ${max}`); return n; }
export const statuses=['Waiting for Verification','Received','Washing','Drying','Ready','Delivered','Cancelled'];
export function validateTransition(current,next) { if(next==='Cancelled'&&current==='Waiting for Verification') return; if(statuses.indexOf(next)!==statuses.indexOf(current)+1||current==='Delivered'||current==='Cancelled') fail(`Cannot move ${current} to ${next}`,409); }
export function validateClothes(clothes) { const types=['Shirts','Pants','T-Shirts','Towels','Bedsheets','Blankets','Others']; if(!clothes||typeof clothes!=='object'||Array.isArray(clothes)) fail('Clothes must be an item count map'); const out={}; for(const [key,value] of Object.entries(clothes)){if(!types.includes(key)) fail('Unknown clothing category');out[key]=number(value,key,0,20,true);} const total=Object.values(out).reduce((a,b)=>a+b,0); if(total<1||total>20) fail('Choose between 1 and 20 garments');return {clothes:out,total}; }
export function parseQr(payload,requireTag=false) { const value=text(payload,'QR payload',200); const parts=value.split('|').map(v=>v.trim()); if(parts.length>2||!/^LID-[A-Za-z0-9-]+$/.test(parts[0])||(parts.length===2&&!/^T[A-Za-z0-9-]+$/.test(parts[1]))||(requireTag&&parts.length!==2)) fail('Expected Laundry ID | Tag serial'); return {laundryId:parts[0],tagSerial:parts[1]}; }
export function localDate(date=new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:process.env.LAUNDRY_TIMEZONE||'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function weekday(date) {return new Intl.DateTimeFormat('en-US',{timeZone:process.env.LAUNDRY_TIMEZONE||'Asia/Kolkata',weekday:'long'}).format(date);}
export function fee(weight,schedule){return Math.round(Math.max(0,weight-schedule.maxWeight)*schedule.extraWeightRate*100)/100;}
