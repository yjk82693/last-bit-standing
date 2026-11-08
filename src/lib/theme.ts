// Visual theme for the single-player table: "circuit-bits" (theme B).
// Colour values live in globals.css under [data-lbs-theme="circuit-bits"];
// this file only names the theme and its mode.
//
// Scope: the theme applies inside the single-player screens (title + table)
// and the dialogs and tooltips they open. Menus, sign-in and the multiplayer
// screens keep the current look until that is decided separately.
export const LBS_THEME = {
  name: "circuit-bits",
  // The theme's primary mode. There is no light/dark switch.
  primaryMode: "dark",
} as const;

// Spread onto the theme root and onto portalled content (dialogs, tooltips),
// which renders outside the root and would otherwise miss the variables.
export const themeScope = { "data-lbs-theme": LBS_THEME.name } as const;
