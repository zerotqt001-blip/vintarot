import VinTarot from '../vintarot';
import Pages from '../pages';
import {getPageMember,toMemberProfileUser,toMemberShellUser} from '@/lib/member-page';
import {notFound} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!['decks','guidebook','journal','daily-spread','game','community','book','bookings','invites','profile'].includes(section))notFound();const member=await getPageMember();const shellUser=toMemberShellUser(member);const user=section==='profile'?toMemberProfileUser(member):shellUser;return <VinTarot user={shellUser} path={'/'+section}><Pages section={section} user={user}/></VinTarot>}
