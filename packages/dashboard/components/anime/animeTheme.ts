import type { SxProps, Theme } from "@mui/material";
import { alpha } from "@mui/material/styles";

export const ANIME_ACCENT = "#02A9FF";
export const ANIME_ACCENT_SOFT = "#68D7FF";
export const ANIME_PINK = "#FF6B9A";
export const ANIME_GOLD = "#FFC857";
export const ANIME_SEASON_PAGE_SIZE = 12;

export const SEASON_OPTIONS = ["current", "next", "WINTER", "SPRING", "SUMMER", "FALL"] as const;
export const SEASON_SCOPES = [
  { value: "airing", label: "Airing / Upcoming", description: "Best for reminders" },
  { value: "chart", label: "Season Chart", description: "Closest to MAL season pages" },
  { value: "tv", label: "TV Only", description: "Filters out specials and movies" },
  { value: "all", label: "All Known Formats", description: "Broad AniList browse" },
] as const;

export type AnimeSeasonOption = (typeof SEASON_OPTIONS)[number];
export type AnimeSeasonScope = (typeof SEASON_SCOPES)[number]["value"];

export const animeShellSx: SxProps<Theme> = {
  position: "relative",
  isolation: "isolate",
  "&::before": {
    content: '""',
    position: "fixed",
    inset: 0,
    zIndex: -1,
    pointerEvents: "none",
    background: "radial-gradient(circle at 22% 6%, rgba(2,169,255,0.18), transparent 34%), radial-gradient(circle at 82% 22%, rgba(255,107,154,0.10), transparent 30%)",
  },
};

export const panelSx: SxProps<Theme> = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 4,
  border: "1px solid",
  borderColor: "rgba(255,255,255,0.10)",
  bgcolor: "rgba(20, 25, 34, 0.92)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
  backdropFilter: "blur(14px)",
};

export const elevatedPanelSx: SxProps<Theme> = {
  ...panelSx,
  background: "linear-gradient(145deg, rgba(18,24,34,0.96), rgba(11,17,27,0.96))",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    borderRadius: "inherit",
    background: "linear-gradient(135deg, rgba(2,169,255,0.16), transparent 42%, rgba(255,107,154,0.10))",
  },
};

export const fieldSx: SxProps<Theme> = {
  "& .MuiInputLabel-root": { color: "rgba(255,255,255,0.62)" },
  "& .MuiInputLabel-root.Mui-focused": { color: ANIME_ACCENT_SOFT },
  "& .MuiOutlinedInput-root": {
    color: "grey.100",
    bgcolor: "rgba(255,255,255,0.045)",
    borderRadius: 2,
    "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
    "&:hover fieldset": { borderColor: "rgba(104,215,255,0.45)" },
    "&.Mui-focused fieldset": { borderColor: ANIME_ACCENT },
  },
  "& .MuiFormHelperText-root": { color: "rgba(255,255,255,0.48)" },
};

export const primaryButtonSx: SxProps<Theme> = {
  borderRadius: 999,
  textTransform: "none",
  fontWeight: 800,
  color: "#03121c",
  bgcolor: ANIME_ACCENT_SOFT,
  boxShadow: `0 12px 30px ${alpha(ANIME_ACCENT, 0.24)}`,
  "&:hover": { bgcolor: ANIME_ACCENT, boxShadow: `0 16px 38px ${alpha(ANIME_ACCENT, 0.28)}` },
};

export const ghostButtonSx: SxProps<Theme> = {
  borderRadius: 999,
  textTransform: "none",
  color: "grey.100",
  borderColor: "rgba(255,255,255,0.16)",
  "&:hover": { borderColor: ANIME_ACCENT_SOFT, bgcolor: "rgba(2,169,255,0.10)" },
};

export const dangerButtonSx: SxProps<Theme> = {
  borderRadius: 999,
  textTransform: "none",
  borderColor: "rgba(255,107,154,0.35)",
  color: ANIME_PINK,
  "&:hover": { borderColor: ANIME_PINK, bgcolor: "rgba(255,107,154,0.10)" },
};
