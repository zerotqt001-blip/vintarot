import VinTarot from './vintarot';
import { getPageMember, toMemberShellUser } from '@/lib/member-page';
export const dynamic = 'force-dynamic';
export default async function Page(){return <VinTarot user={toMemberShellUser(await getPageMember())}/>}
