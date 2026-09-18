import Room from './room';
import { LanguageProvider } from '@/components/language';
import {requirePageMember,toMemberShellUser} from '@/lib/member-page';
export const dynamic='force-dynamic';

type QueryValue = string | string[] | undefined;

export default async function Page({searchParams}:{searchParams:Promise<Record<string,QueryValue>>}){
 const query=await searchParams;
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(query)){for(const item of Array.isArray(value)?value:[value])if(item!==undefined)params.append(key,item)}
 const search=params.toString();
 const returnTo=search?`/room?${search}`:'/room';
 const user=toMemberShellUser(await requirePageMember(returnTo));
 return <LanguageProvider user={user}><Room user={user}/></LanguageProvider>
}
