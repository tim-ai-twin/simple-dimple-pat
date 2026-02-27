export const colors = {
  primary: "#8B3A2A",
  primaryLight: "#A85340",
  primaryDark: "#6B2A1E",
  background: "#FAF3EB",
  backgroundDark: "#F0E6D8",
  text: "#3D2017",
  textLight: "#6B5144",
  textOnPrimary: "#FAF3EB",
  border: "#D4B8A0",
  borderLight: "#E8D5C4",
  success: "#2D7D46",
  warning: "#C17D10",
  error: "#C53030",
  disabled: "#A0917E",
} as const;

export const typography = {
  fontHeading: "'Playfair Display', Georgia, serif",
  fontBody: "'Inter', system-ui, -apple-system, sans-serif",
  sizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
  },
} as const;

export const spacing = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  "2xl": "3rem",
} as const;

export const borderRadius = {
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  pill: "9999px",
} as const;
