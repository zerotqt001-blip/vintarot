import type { ShellVariant } from "./types";

const backgroundByVariant: Partial<Record<ShellVariant, string>> = {
  home: "home",
  library: "library",
  practice: "practice",
  membership: "membership",
  affiliate: "affiliate",
  account: "account",
  reading: "reading",
  immersive: "immersive",
  create: "create",
  daily: "daily",
};

export default function CelestialBackground({ variant }: { variant: ShellVariant }) {
  if (variant !== "home") {
    return <div className="celestial-background" data-celestial-background={backgroundByVariant[variant] ?? "observatory"} aria-hidden="true" />;
  }
  return <div className="cosmic-scene" aria-hidden="true">
    <div className="cosmic-layer cosmic-sky" />
    <div className="cosmic-layer cosmic-nebula" />
    <div className="cosmic-layer cosmic-planets" />
    <div className="cosmic-layer cosmic-architecture" />
    <div className="cosmic-layer cosmic-floor" />
    <div className="cosmic-layer cosmic-foreground" />
  </div>;
}
