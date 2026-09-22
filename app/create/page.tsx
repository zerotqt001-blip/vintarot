import VinTarot from '../vintarot';
import CreateRitual from './ritual';
import {getPageMember,toMemberShellUser} from '@/lib/member-page';
export const dynamic='force-dynamic';
export default async function Page(){return <VinTarot path="/create" user={toMemberShellUser(await getPageMember())}><CreateRitual/></VinTarot>}
