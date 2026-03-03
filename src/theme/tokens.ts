export const colors = {
  primary: "#B84B30",
  primaryLight: "#D06B52",
  primaryDark: "#8B3A2A",
  background: "#F8F4E9",
  backgroundDark: "#EDE5D4",
  text: "#2C1810",
  textLight: "#6B5144",
  textOnPrimary: "#F8F4E9",
  border: "#D4BAA0",
  borderLight: "#E8D5C4",
  success: "#2D7D46",
  warning: "#C17D10",
  error: "#C53030",
  disabled: "#A0917E",
} as const;

export const typography = {
  fontHeading: "'DM Serif Display', Georgia, serif",
  fontBody: "'DM Sans', system-ui, -apple-system, sans-serif",
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
