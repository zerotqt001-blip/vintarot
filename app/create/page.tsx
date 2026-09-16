import VinTarot from '../vintarot';
import CreateRitual from './ritual';
import {getChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Page(){const u=await getChatGPTUser();return <VinTarot user={u?{name:u.fullName||u.email.split('@')[0],email:u.email}:null}><CreateRitual/></VinTarot>}
