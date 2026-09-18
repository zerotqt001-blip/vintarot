import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMemberFromCookieHeader, safeRelativeReturnPath, SESSION_COOKIE_NAME, type MemberView } from "@/lib/member-auth";

export type MemberShellUser = { name: string; email: string; username: string } | null;
export type MemberProfileUser = { name: string; email: string; username: string; phone?: string } | null;

export async function getPageMember(): Promise<MemberView | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;
  const { getRuntimeDatabase } = await import("@/lib/runtime");
  return getMemberFromCookieHeader(getRuntimeDatabase(), cookieStore.toString());
}

export async function requirePageMember(returnTo: string): Promise<MemberView> {
  const member = await getPageMember();
  if (member) return member;
  redirect(`/auth?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`);
}

export function toMemberShellUser(member: MemberView | null): MemberShellUser {
  if (!member) return null;
  return { name: member.displayName || member.username, email: member.email, username: member.username };
}

export function toMemberProfileUser(member: MemberView | null): MemberProfileUser {
  const user = toMemberShellUser(member);
  return user && member ? { ...user, phone: member.phone } : null;
}
