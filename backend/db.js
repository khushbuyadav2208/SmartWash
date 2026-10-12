import mongoose from 'mongoose';
import { models } from './models.js';
export async function connectDb(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required. JSON fallback is disabled.');
  mongoose.set('bufferCommands', false);
  await mongoose.connect(uri, {serverSelectionTimeoutMS:10000});
  const hello = await mongoose.connection.db.admin().command({hello:1});
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    await mongoose.disconnect();
    throw new Error('MongoDB replica set is required for atomic multi-entity writes. See README.');
  }
  await Promise.all(Object.values(models).map(m=>m.init()));
}
export async function transaction(work) {
  const session = await mongoose.startSession();
  try { let result; await session.withTransaction(async()=>{result = await work(session);}); return result; }
  finally { await session.endSession(); }
}
export const disconnectDb = () => mongoose.disconnect();
