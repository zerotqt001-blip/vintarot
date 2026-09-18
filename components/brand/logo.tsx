import Image from "next/image";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type LogoVariant = "dark" | "light" | "icon";

type LogoProps = Omit<ComponentProps<"span">, "children"> & {
  variant?: LogoVariant;
  compact?: boolean;
  href?: string;
  priority?: boolean;
};

const logoAssets: Record<LogoVariant, { src: string; width: number; height: number }> = {
  dark: { src: "/brand/natarot-logo-dark.svg", width: 420, height: 112 },
  light: { src: "/brand/natarot-logo-light.svg", width: 420, height: 112 },
  icon: { src: "/brand/natarot-icon.svg", width: 128, height: 128 },
};

export function Logo({
  variant = "dark",
  compact = false,
  href,
  priority = false,
  className,
  ...props
}: LogoProps) {
  const asset = logoAssets[variant];
  const image = (
    <Image
      src={asset.src}
      width={asset.width}
      height={asset.height}
      alt="NaTarot"
      priority={priority}
      className="brand-logo-image"
    />
  );
  const content = (
    <span
      data-brand-logo={variant}
      className={cn("brand-logo", compact && "brand-logo--compact", variant === "icon" && "brand-logo--icon", className)}
      {...props}
    >
      {image}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} aria-label="NaTarot" className={cn("brand-logo-link", className)}>
      {content}
    </Link>
  );
}

export default Logo;
