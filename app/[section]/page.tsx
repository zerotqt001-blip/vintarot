import VinTarot from '../vintarot';
import Pages from '../pages';
import {getChatGPTUser} from '../chatgpt-auth';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!['decks','guidebook','journal','daily-spread','game','community','book','bookings','invites','profile'].includes(section))notFound();const u=await getChatGPTUser();const user=u?{name:u.fullName||u.email.split('@')[0],email:u.email}:null;return <VinTarot user={user} path={'/'+section}><Pages section={section} user={user}/></VinTarot>}
