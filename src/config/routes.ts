// docs/04-routing-and-layouts.md — build URLs here, not with string concatenation.
export const routes = {
  home: () => "/",
  login: () => "/login",
  register: () => "/register",
  forgotPassword: () => "/forgot-password",
} as const;
