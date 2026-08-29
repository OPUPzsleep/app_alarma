// Paleta y escala únicas de la app (pensadas para adultos mayores: texto y
// botones grandes, un solo tema fijo de alto contraste en vez de
// claro/oscuro automático). No depende de constants/theme.ts (boilerplate
// de Expo sin conexión con la pantalla real, eliminado).
export const COLORS = {
  bg: "#F5F3ED",
  card: "#FFFFFF",
  ink: "#1E2B29",
  inkSoft: "#4C5A57",
  teal: "#0F5C56",
  tealDark: "#0A413D",
  amber: "#E8873A",
  amberDark: "#C96A20",
  amberBg: "#FBEBD9",
  green: "#3F7D5C",
  greenBg: "#E4F0E9",
  red: "#C0392B",
  line: "#E1DDD1",
};

export const FONT_SIZES = {
  screenTitle: 26,
  medName: 22,
  medDetail: 18,
  formLabel: 17,
  helperText: 15,
  button: 19,
  chat: 17,
  tabLabel: 14,
  small: 15,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// Alto mínimo táctil recomendado para este público (por encima del mínimo
// de 44-48dp habitual, que en pruebas quedaba justo).
export const TOUCH = {
  button: 62,
  tabItem: 64,
  input: 58,
};
