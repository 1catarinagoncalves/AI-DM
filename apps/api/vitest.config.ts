import { defineConfig, configDefaults } from 'vitest/config'

// US-95: config do `pnpm test` da API, que até aqui rodava nos defaults do Vitest.
// Existe por UMA linha — o exclude dos `*.int.test.ts`. Sem ele os testes de
// integração entram no `vitest run` default e o `pnpm test` passa a exigir Postgres,
// derrubando a medição da US-80 (*Questões em aberto* #2) que esta story tem de
// preservar. Herda o exclude padrão em vez de o substituir: escrevê-lo à mão
// silenciaria node_modules/dist na primeira vez que o Vitest mudar os seus.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/*.int.test.ts'],
  },
})
