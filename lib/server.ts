import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export function db(){if(!env.DB)throw new Error('Storage is not available. Please try again shortly.');return env.DB;}
export async function identity(){const u=await getChatGPTUser();if(!u)throw new Response(JSON.stringify({error:'Please sign in to save your work.'}),{status:401,headers:{'Content-Type':'application/json'}});return u;}
export function originCheck(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new Response('Forbidden',{status:403});}
export async function boundary(fn:()=>Promise<Response>){try{return await fn()}catch(e){if(e instanceof Response)return e;console.error('VinTarot API',e instanceof Error?e.message:'Request failed');return Response.json({error:'Could not complete this request. Your input has been kept; please try again.'},{status:503})}}
export async function json(req:Request){const text=await req.text();if(text.length>100000)throw new Response('Request too large',{status:413});try{return JSON.parse(text)}catch{throw new Response('Invalid JSON',{status:400})}}
