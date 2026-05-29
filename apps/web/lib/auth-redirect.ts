// lib/auth-redirect.ts
export function getPostAuthRedirect(user: any, hasAcceptedTerms: boolean): string {
  if (!hasAcceptedTerms) return '/terms';          // show terms first
  if (user?.role === 'superadmin') return '/admin/dashboard';
  return '/home';                                   // all other roles
}