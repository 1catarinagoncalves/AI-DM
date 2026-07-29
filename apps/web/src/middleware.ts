export { auth as middleware } from '@/auth'

// US-61 (D3): login obrigatório. O middleware do Auth.js protege todas as páginas;
// não-autenticado é redirecionado para /login (pages.signIn). Exclui os assets do
// Next, as rotas de auth e o próprio /login. O proxy /api/chat fica de fora do
// matcher e é barrado pelo guard da API (que rejeita sem Bearer válido).
//
// `.*\..*` exclui tudo o que tem extensão (arte de cena, ícones). Não basta excluir
// `_next/image`: o otimizador vai buscar o PNG de origem por HTTP em /scenes/*.png,
// e sem esta regra essa busca era redirecionada para /login — o Next recebia HTML e
// respondia 400 "isn't a valid image". Nenhuma rota de página tem ponto no caminho.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|.*\\..*).*)'],
}
