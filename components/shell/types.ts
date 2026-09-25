import type { ReactNode } from "react";

export type NaTarotUser = { name: string; email: string; username: string } | null;

export type ShellVariant =
  | "standard"
  | "home"
  | "library"
  | "practice"
  | "membership"
  | "affiliate"
  | "account"
  | "reading"
  | "immersive"
  | "create"
  | "daily";

export type Translator = (key: string) => string;
export type ShellModal = "" | "help";

export type NaTarotShellProps = {
  user: NaTarotUser;
  children?: ReactNode;
  path: string;
};
