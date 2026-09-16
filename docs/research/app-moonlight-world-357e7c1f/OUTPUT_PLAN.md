# VinTarot continuation plan

User authorizes updating the existing VinTarot routes using the upstream clone-website workflow. Preserve working data/authentication and the Sites runtime.

Source origin: https://app.moonlight.world
Destination: existing VinTarot project.
Routes: /, /decks, /guidebook, /community, /journal, /game, /daily-spread, /book, /bookings, /invites, /profile, /room.
Source room IDs map to VinTarot /room?id= with VinTarot-owned records; never copy original account data.
Shared implementation: app/vintarot.tsx, app/globals.css, components/card-mark.tsx.
Room implementation: app/room/room.tsx. Existing routes are approved updates, not replacement applications.

Priority: quantify reference motion, compare at identical viewport dimensions, validate dragging/flipping/persistence, then responsive pass.
Known incomplete integrations: video provider, payments, email, reader onboarding and public access. Do not claim production parity.
