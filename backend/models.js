import mongoose from 'mongoose';
const { Schema } = mongoose;
const str = { type: String, required: true, trim: true };
const id = { ...str, unique: true };
const options = { timestamps: true, versionKey: false, strict: true };
const demoBatch = {type:String,index:true};
const make = (name, shape, indexes = []) => {
  const schema = new Schema({...shape,demoBatch}, options);
  indexes.forEach(([keys, opts]) => schema.index(keys, opts));
  return mongoose.model(name, schema);
};
const tag = new Schema({ serialNumber: str, garmentName:{type:String,maxLength:100}, category:{type:String,enum:['Shirts','Pants','T-Shirts','Towels','Bedsheets','Blankets','Others']}, status: {type: String, enum: ['active','lost','damaged','disabled'], default:'active'} }, {_id:false});
export const User = make('User', { id, email: {...str, lowercase:true, unique:true}, passwordHash: str,
  role: {type:String,enum:['student','staff','admin'],required:true}, name:str, studentId:String, hostelId:String, counter:String,
  active:{type:Boolean,default:true}, verified:{type:Boolean,default:false} });
export const Student = make('Student', {id, name:str, email:{...str,lowercase:true,unique:true}, rollNumber:String,rollKey:{type:String,unique:true,sparse:true},regNumber:String,mobile:String,
  hostelId:str,floor:Number,room:str,laundryId:{...str,unique:true},tags:[tag],status:{type:String,enum:['active','inactive'],default:'active'}}, [[{hostelId:1},{}],[{'tags.serialNumber':1},{unique:true}]]);
export const Hostel = make('Hostel', {id,name:str,nameKey:{type:String,unique:true,sparse:true},color:{type:String,default:'#4f46e5'},rooms:[String],roomDetails:[new Schema({number:str,building:String,floor:{type:Number,min:0,max:100},capacity:{type:Number,min:1,max:100}},{_id:false})],active:{type:Boolean,default:true}});
export const Schedule = make('Schedule', {hostelId:{...str,unique:true},days:[String],pickup:str,delivery:str,emergencyEnabled:Boolean,
  maxWeight:{type:Number,min:0.1,default:5},extraWeightRate:{type:Number,min:0,default:20},capacity:{type:Number,min:1,default:100},processingHours:{type:Number,min:1,default:24}});
export const Order = make('Order',{id,studentId:str,studentName:str,laundryId:str,hostelId:str,room:str,clothes:{type:Map,of:Number},expectedTotal:{type:Number,min:1,required:true},
  scannedTags:[String],status:{type:String,enum:['Waiting for Verification','Received','Washing','Drying','Ready','Delivered','Cancelled'],required:true},
  pickup:{at:Date,actorId:String,station:String,verifiedCount:Number},delivery:{at:Date,actorId:String,station:String,tagSerial:String,studentConfirmedAt:Date},billing:Schema.Types.Mixed,issue:Schema.Types.Mixed,weight:Number,overLimitCharge:Number,pricing:Schema.Types.Mixed,pickupDate:String,estimatedReadyAt:Date,
  history:[{status:String,timestamp:Date,note:String,actorId:String,station:String}]}, [[{studentId:1,createdAt:-1},{}],[{hostelId:1,status:1,pickupDate:1},{}],
  [{studentId:1},{unique:true,partialFilterExpression:{status:{$in:['Waiting for Verification','Received','Washing','Drying','Ready']}}}]]);
export const Issue = make('Issue',{id,studentId:str,studentName:str,laundryId:str,hostelId:str,requestId:String,type:str,description:str,
  status:{type:String,enum:['Pending','Assigned','Resolved'],default:'Pending'},assignedTo:String,resolution:String,resolvedAt:Date},[[{studentId:1,createdAt:-1},{}],[{hostelId:1,status:1},{}]]);
export const Notification = make('Notification',{id,targetType:{type:String,enum:['all','hostel','individual'],required:true},userId:String,hostelId:String,message:str,readBy:[String]},[[{userId:1,createdAt:-1},{}]]);
export const ScanEvent = make('ScanEvent',{id,requestId:str,tagSerial:String,actorId:str,station:String,kind:{type:String,enum:['receive','delivery'],required:true}},[[{requestId:1,tagSerial:1,kind:1},{unique:true}]]);
export const Audit = make('Audit',{id,actorId:str,action:str,entityId:String,details:Schema.Types.Mixed},[[{createdAt:-1},{}]]);
export const Session = make('Session',{hash:{...str,unique:true},userId:str,expiresAt:{type:Date,required:true}},[[{expiresAt:1},{expireAfterSeconds:0}]]);
export const AuthToken = make('AuthToken',{hash:{...str,unique:true},userId:str,kind:{type:String,enum:['reset','verify'],required:true},expiresAt:{type:Date,required:true}},[[{expiresAt:1},{expireAfterSeconds:0}]]);
export const models = { User, Student, Hostel, Schedule, Order, Issue, Notification, ScanEvent, Audit, Session, AuthToken };
export const plain = doc => { if(!doc) return null; const p = doc.toObject ? doc.toObject({flattenMaps:true}) : {...doc}; delete p._id; delete p.passwordHash; return p; };
