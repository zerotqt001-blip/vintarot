import {boundary,identity} from '@/lib/server';
export async function GET(){return boundary(async()=>{await identity();return Response.json({video:false,payments:false,email:false,publicAccess:false,message:'Video, payments and email are not connected yet. Your tarot rooms and journal are available.'})})}
