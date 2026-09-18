import { getRuntimeDatabase } from '@/lib/runtime';
import { attachIdentityCookie, readRequestIdentity } from '@/lib/request-identity';
export function db(){return getRuntimeDatabase();}
export async function identity(request:Request){return readRequestIdentity(request);}
export { attachIdentityCookie };
export function originCheck(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Response('Forbidden',{status:403});}
export async function boundary(fn:()=>Promise<Response>){try{return await fn()}catch(e){if(e instanceof Response)return e;console.error('VinTarot API',e instanceof Error?e.message:'Request failed');return Response.json({error:'Could not complete this request. Your input has been kept; please try again.'},{status:503})}}
export async function json(req:Request){const text=await req.text();if(text.length>100000)throw new Response('Request too large',{status:413});try{return JSON.parse(text)}catch{throw new Response('Invalid JSON',{status:400})}}
