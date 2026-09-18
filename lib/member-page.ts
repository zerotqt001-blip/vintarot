import "server-only";

import { cookies } from "next/headers";
import { getMemberFromCookieHeader, type MemberView } from "@/lib/member-auth";
import { getRuntimeDatabase } from "@/lib/runtime";

export type MemberShellUser = { name: string; email: string; username: string } | null;
export type MemberProfileUser = { name: string; email: string; username: string; phone?: string } | null;

export async function getPageMember(): Promise<MemberView | null> {
  const cookieStore = await cookies();
  return getMemberFromCookieHeader(getRuntimeDatabase(), cookieStore.toString());
}

export function toMemberShellUser(member: MemberView | null): MemberShellUser {
  if (!member) return null;
  return { name: member.displayName || member.username, email: member.email, username: member.username };
}

export function toMemberProfileUser(member: MemberView | null): MemberProfileUser {
  const user = toMemberShellUser(member);
  return user && member ? { ...user, phone: member.phone } : null;
}
