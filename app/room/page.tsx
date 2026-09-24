import Room from './room';
import { LanguageProvider } from '@/components/language';
import { SidebarProvider } from '@/components/ui/sidebar';
import {getPageMember,toMemberShellUser} from '@/lib/member-page';
export const dynamic='force-dynamic';
export default async function Page(){const user=toMemberShellUser(await getPageMember());return <SidebarProvider><LanguageProvider user={user}><Room user={user}/></LanguageProvider></SidebarProvider>}
