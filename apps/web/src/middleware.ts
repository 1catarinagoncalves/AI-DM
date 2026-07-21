export { auth as middleware } from '@/auth'

// US-61 (D3): login obrigatório. O middleware do Auth.js protege todas as páginas;
// não-autenticado é redirecionado para /login (pages.signIn). Exclui os assets do
// Next, as rotas de auth e o próprio /login. O proxy /api/chat fica de fora do
// matcher e é barrado pelo guard da API (que rejeita sem Bearer válido).
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
}
