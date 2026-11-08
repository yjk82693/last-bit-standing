// Visual theme for every screen: "circuit-bits" (theme B).
// Colour values live in globals.css under [data-lbs-theme="circuit-bits"];
// this file only names the theme and its mode.
//
// Scope: the root layout puts the attribute on <html>, so menus, sign-in,
// multiplayer, leaderboard, bench and the single-player table all use it,
// and so do dialogs and tooltips (they portal into <body>).
export const LBS_THEME = {
  name: "circuit-bits",
  // The theme's primary mode. There is no light/dark switch.
  primaryMode: "dark",
} as const;

// Spread onto <html> in the root layout. Some single-player components still
// spread it on their own root and portals; that is harmless (same values).
export const themeScope = { "data-lbs-theme": LBS_THEME.name } as const;
