export const ROUTES = {
  login: '/login',
  applications: '/applications',
  application: (id: string) => `/applications/${id}`,
} as const;
