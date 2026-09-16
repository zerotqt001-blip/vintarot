import VinTarot from './vintarot';
import { getChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Page(){const user=await getChatGPTUser();return <VinTarot user={user ? {name:user.fullName || user.email.split('@')[0],email:user.email}:null}/>}
