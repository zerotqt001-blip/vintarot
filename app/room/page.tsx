import Room from './room';
import { LanguageProvider } from '@/components/language';
import {getPageMember,toMemberShellUser} from '@/lib/member-page';
export const dynamic='force-dynamic';
export default async function Page(){const user=toMemberShellUser(await getPageMember());return <LanguageProvider user={user}><Room user={user}/></LanguageProvider>}
