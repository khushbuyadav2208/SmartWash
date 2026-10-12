// Browser-only contract fixtures. Never starts a backend or opens a database.
export async function installFixtures(page,role,{empty=false,error=false,delay=0,active=true}={}){
 const now=new Date().toISOString(),date=now.slice(0,10),calls=[];
 const hostels=[{id:'qa-h1',name:'QA North Residence',color:'#2563eb',rooms:['101','102'],active:true},{id:'qa-h2',name:'QA East Residence',color:'#17a8c7',rooms:['201'],active:true},{id:'qa-h3',name:'QA West Residence',color:'#5876a6',rooms:['301'],active:true}];
 const student={id:'qa-student',userId:'qa-user',name:'QA Student',email:'student@qa.invalid',role:'student',hostelId:'qa-h1',room:'101',floor:1,rollNumber:'QA-101',mobile:'',laundryId:'QA-L001',status:'active',tags:[1,2,3,4].map(n=>({serialNumber:`QA-T00${n}`,status:'active',garmentName:n===1?'Campus shirt':'',category:'Shirts'}))};
 const user=role==='student'?student:{id:`qa-${role}`,userId:`qa-${role}`,name:`QA ${role==='admin'?'Admin':'Staff'}`,role,email:`${role}@qa.invalid`,hostelId:role==='staff'?'qa-h1':undefined,counter:'North Desk'};
 const statuses=['Waiting for Verification','Received','Washing','Drying','Ready','Delivered'];
 let orders=empty?[]:Array.from({length:14},(_,i)=>({id:`QA-ORD-${100+i}`,studentId:i===0?'qa-student':`qa-s${i}`,studentName:i===0?'QA Student':`QA Resident ${i+1}`,laundryId:i===0?'QA-L001':`QA-L${i+1}`,hostelId:hostels[i%3].id,hostelName:hostels[i%3].name,hostelColor:hostels[i%3].color,room:'101',createdAt:new Date(Date.now()-i*3600000).toISOString(),pickupDate:date,status:statuses[i%6],clothes:{Shirts:2,Pants:1,'T-Shirts':1},expectedTotal:4,scannedTags:i%6===0?[]:['QA-T001','QA-T002','QA-T003','QA-T004'],...(i%6?{weight:4.2,overLimitCharge:0,estimatedReadyAt:now,pricing:{maxWeight:5,extraWeightRate:20,currency:'INR'}}:{}),history:[{status:'Waiting for Verification',timestamp:now,note:'Booking received'}]}));
 if(role==='student'&&!empty)orders=[{...orders[0],status:active?'Washing':'Delivered',scannedTags:['QA-T001','QA-T002','QA-T003','QA-T004'],weight:4.2,pricing:{maxWeight:5,extraWeightRate:20,currency:'INR'},overLimitCharge:0},...orders.slice(1,3).map(o=>({...o,studentId:student.id,studentName:student.name,hostelId:'qa-h1',hostelName:hostels[0].name,status:'Delivered'}))];
 let notifications=[{id:'qa-notification',message:'QA update: hostel laundry schedule is available.',createdAt:now,read:false}];
 const schedules=hostels.map(h=>({hostelId:h.id,days:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],pickup:'08:00',delivery:'18:00',maxWeight:5,extraWeightRate:20,capacity:100,processingHours:24,emergencyEnabled:true}));
 const stats={totalHostels:3,totalStudents:48,totalStaff:6,todayRequestsCount:empty?0:14,totalWeightToday:empty?0:46.2,averageBagWeight:empty?0:4.2,pendingRequests:empty?0:12,completedRequests:empty?0:2,overdueCount:0,dailyCounts:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label,i)=>({date:`qa-day-${i}`,label,count:empty?0:[6,10,8,14,9,12,14][i]})),hostelStats:hostels.map((h,i)=>({...h,count:empty?0:[5,5,4][i]})),statusCounts:empty?[]:statuses.map((status,i)=>({status,count:i<2?3:2})),recentActivities:empty?[]:[{studentName:'QA Student',laundryId:'QA-L001',status:'Washing',timestamp:now}]};
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname,method=req.method(),body=req.postDataJSON();calls.push({path:p,method,body});
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(p==='/api/auth/me')return role?reply({user}):reply({message:'Sign in required'},401);
  if(p==='/api/auth/hostels')return reply(hostels);
  if(p==='/api/auth/logout')return reply({message:'Signed out'});
  if(p==='/api/auth/login')return body.password==='wrong'?reply({message:'Invalid email or password'},401):reply({user:{...user,role:body.portal||'student'}});
  if(p==='/api/auth/forgot-password')return reply({message:'Email service is not configured'},503);
  if(p==='/api/notifications'){if(method==='POST'){notifications.push({id:'qa-announcement',message:body.message,createdAt:now,read:false});return reply({message:'Sent'});}return reply(notifications);}
  if(p.endsWith('/read')){notifications=notifications.map(n=>({...n,read:true}));return reply({});}
  if(delay)await new Promise(r=>setTimeout(r,delay));
  if(error&&method==='GET'&&p!=='/api/notifications')return reply({message:'QA service unavailable. Please retry.'},503);
  if(p==='/api/dashboard/admin')return reply(stats);
  if(p==='/api/hostels')return reply(hostels);
  if(p.includes('/hostels/')&&method==='DELETE'){hostels.splice(hostels.findIndex(h=>h.id===p.split('/')[3]),1);return reply({});}
  if(p.includes('/hostels/')&&method==='PUT')return reply({});
  if(p==='/api/students')return reply([{...student,hostelName:hostels[0].name,hostelColor:'#2563eb'}]);
  if(p==='/api/staff')return reply([{id:'qa-staff',name:'QA Staff',email:'staff@qa.invalid',hostelId:'qa-h1',hostelName:hostels[0].name,hostelColor:'#2563eb',counter:'North Desk',active:true}]);
  if(p==='/api/schedules')return reply(schedules);
  if(p==='/api/pickup-options')return reply({today:date,timeZone:'Asia/Kolkata',options:[{date,eligible:true,remaining:86,scheduled:true}]});
  if(p==='/api/issues')return reply([]);
  if(p==='/api/audit')return reply(Array.from({length:14},(_,i)=>({id:`qa-a${i}`,createdAt:now,actorId:'qa-admin',action:'order.status',entityId:`QA-ORD-${100+i}`})));
  if(p==='/api/activity')return reply({items:[],total:0,pages:0});
  if(p==='/api/requests'&&method==='POST'){orders.unshift({...orders[0],id:'QA-NEW-ORDER',status:'Waiting for Verification',clothes:body.clothes,expectedTotal:Object.values(body.clothes).reduce((a,b)=>a+b,0),pickupDate:body.pickupDate,studentId:student.id,studentName:student.name,laundryId:student.laundryId,hostelId:student.hostelId,scannedTags:[],createdAt:now,history:[]});return reply(orders[0]);}
  if(p==='/api/requests/scan-first')return reply({student,request:orders[0],message:'Order identified'});
  if(p==='/api/requests/scan-tag'){const tag=body.payload.split('|')[1]?.trim();if(!orders[0].scannedTags.includes(tag))orders[0].scannedTags.push(tag);return reply({request:orders[0],message:'Tag verified'});}
  if(p==='/api/requests/scan-delivery'){orders[0].status='Delivered';return reply({request:orders[0]});}
  if(p.endsWith('/status')){const o=orders.find(o=>o.id===p.split('/')[3]);o.status=body.status;if(body.weight)o.weight=body.weight;return reply(o);}
  if(p.endsWith('/cancel')){orders[0].status='Cancelled';return reply(orders[0]);}
  if(p.startsWith('/api/requests')&&method==='GET')return reply(orders);
  return reply({});
 });
 return {calls,user,date,stats};
}
export async function capture(page,name){
 await page.getByText('Refreshing records…',{exact:true}).waitFor({state:'hidden'});
 const refresh=page.getByRole('button',{name:'Refresh workspace'});if(await refresh.count())await refresh.waitFor({state:'attached'});
 if(await page.locator('.app-container:not(.nav-open)').count()&&page.viewportSize().width<=760)await page.waitForFunction(()=>{const r=document.querySelector('.sidebar').getBoundingClientRect();return r.right<=0;});
 await page.evaluate(()=>document.activeElement?.blur());
 await page.addStyleTag({content:'.qa-capture-label{position:fixed;left:50%;bottom:8px;transform:translateX(-50%);z-index:999;background:#13243e;color:white;padding:6px 12px;border-radius:4px;font:9px system-ui;letter-spacing:.4px;pointer-events:none}'});
 await page.evaluate(()=>{document.querySelector('.qa-capture-label')?.remove();const label=document.createElement('div');label.className='qa-capture-label';label.textContent='UI QA · API fixtures · No database connected';document.body.append(label);});
 await page.screenshot({path:`../ui-preview/${name}.png`,fullPage:true,animations:'disabled'});
}
