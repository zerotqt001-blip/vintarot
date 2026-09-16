import Room from './room';
import { LanguageProvider } from '@/components/language';
import {getChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Page(){const u=await getChatGPTUser();const user=u?{name:u.fullName||u.email.split('@')[0],email:u.email}:null;return <LanguageProvider user={user}><Room user={user}/></LanguageProvider>}
