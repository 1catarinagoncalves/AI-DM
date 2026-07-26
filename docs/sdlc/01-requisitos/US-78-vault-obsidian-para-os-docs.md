# US-78 — Vault Obsidian sobre `docs/` (backlink automático + índice vivo por Dataview)

**Épico:** 5 — Ferramentas de projeto / SDLC
**Fase:** 1 — MVP single-player
**Status:** ✅ Implementada
**Depende de:** nenhuma. Interage com [US-31](./US-31-quadro-kanban-de-user-stories.md) (o quadro Kanban lê e reescreve a linha `**Status:**` dos mesmos arquivos) e com [US-79](./US-79-consertar-links-quebrados-na-documentacao.md), que cobre a outra metade dos links quebrados. Podem ser feitas em qualquer ordem.
**Criada em:** 2026-07-26

---

## História

> **Como** desenvolvedora / dona do produto,
> **quero** abrir `docs/` como vault do Obsidian com backlink automático e um índice de user stories gerado por Dataview,
> **para que** renomear ou criar um documento não quebre mais os links entre eles, e para que eu pare de manter à mão um índice que já apodreceu uma vez.

---

## Contexto e motivação

### O problema medido

Varredura dos links relativos dos **83** `.md` versionados em `docs/` (26/07/2026, `main` @ `2ac79f6`), usando a mesma taxonomia da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md). Reproduzível: `pnpm docs:links --naive` (ver *Varredura*, abaixo).

| Métrica | Valor | Dono |
|---|---:|---|
| Links relativos totais | 634 | — |
| **Quebrados** (sufixo `:NN` tratado como válido) | **101** | — |
| ├ profundidade errada, resolução única (`../../` → `../../../`) | 82 | US-79 |
| ├ alvo não existe, apontando para código | 3 | US-79 |
| └ **alvo não existe, apontando para `.md`** | **16** | **esta story** |
| Ambíguos (>1 candidato) | 0 | — |

As duas stories cobrem os 101 sem sobreposição e sem lacuna: **82 + 3 = 85** vão para a US-79, **16** ficam aqui.

Os 82 de profundidade são bug de path (`../../apps/` a partir de `docs/sdlc/01-requisitos/` cai em `docs/apps/`) — **fora do escopo desta story**: o Obsidian não indexa TypeScript e não resolveria esses links de forma alguma. Os 3 de código sem candidato (`ingest.ts` que na verdade é `.mjs`, `session.ts` que não existe) exigem decisão humana caso a caso, também na US-79.

> **Correção de contagem (26/07/2026).** As duas primeiras linhas desta tabela diziam **79 arquivos** e **620 links** quando medidas à mão. O número certo é **83** e **634**. A contagem manual usou `git ls-tree --name-only | grep '\.md$'`, e o git **põe entre aspas** todo path com espaço ou byte não-ASCII (`core.quotePath`) — o `$` do grep não casa mais, e o arquivo desaparece do total sem aviso. Os 4 perdidos: `US-02-inventário personagem.md`, `US-43-calibracao-peso-traços-identidade.md`, `trecho correcao dplicação e rolagem.md`, `trecho duuplicação 2.md`. Todos com espaço, acento, ou os dois.
>
> Os números de **quebrados** não mudaram (`101 = 82 + 3 + 16`, 0 ambíguos): os 14 links dos 4 arquivos perdidos são todos válidos. A ironia fica registrada — os arquivos que o grep engoliu são justamente os de nome mais frágil, que precisam de `%20` no link para funcionar.

> **Nota de contagem.** Uma varredura ingênua conta 107 quebrados: soma 6 links no formato `arquivo.mjs:122` (convenção `file:line` do `CLAUDE.md`), cujo caminho **sem** o sufixo existe. Aqui, como na US-79, esses 6 contam como válidos. `107 = 82 + 3 + 16 + 6`.

Os 16 de `.md` apontam para 6 alvos, e nenhum é erro de digitação — são **8** para `user-stories.md`, 3 para `US-45`, 2 cada para `US-29`/`US-36`/`US-67`, 1 para o relatório de eval:

| Link morto | Arquivo real hoje |
|---|---|
| `./US-29-saneamento-de-rolagens.md` | `US-29-saneamento-de-rolagens-ficticias.md` |
| `./US-36-eval-qualidade-narracao.md` | `US-36-eval-de-qualidade-da-narracao.md` |
| `./US-45-background-visivel-na-ficha.md` | `US-45-background-na-ficha-da-interface.md` |
| `./US-67-edicao-de-turno.md` | `US-67-editar-acao-enviada-ao-dm.md` |
| `./user-stories.md` | **não existe** (apagado; 8 links ainda apontam) |
| `../../../evals/reports/2026-07-10.md` | gerado, `.gitignore` (US-36) |

O padrão é sempre o mesmo: **o arquivo foi renomeado e todos os links que apontavam para ele morreram em silêncio.** Ninguém avisa. Só se descobre ao clicar. Já aconteceu 4 vezes em ~61 stories.

### Por que a solução atual não basta

- Os links são escritos à mão. Não há autocomplete, então o nome do arquivo é digitado de memória — daí `US-36-eval-qualidade-narracao` em vez de `US-36-eval-de-qualidade-da-narracao`.
- Não havia verificação. `pnpm typecheck` não olha markdown; o Kanban (US-31) só lê `**Status:**` e `**Épico:**`, nunca os links. Esta story fecha isso com `pnpm docs:links`.
- O índice `user-stories.md` foi apagado, mas 8 links continuam apontando para ele. Índice mantido à mão é índice que diverge — foi exatamente a motivação da US-31, e o mesmo problema voltou uma camada acima.

### A proposta

Abrir **`docs/` como vault do Obsidian** (não a raiz do repo — ver *Decisões* abaixo), com três configurações que fazem o trabalho:

1. **Links em formato Markdown relativo, não wikilink.** O Obsidian passa a escrever `[texto](./US-XX-....md)` — idêntico aos 620 links que já existem, e que continua renderizando no GitHub.
2. **Atualização automática de links internos.** Renomear um `.md` reescreve todos os links que apontam para ele, em todos os arquivos do vault.
3. **Autocomplete ao digitar `[`** — só oferece arquivos que existem, então link quebrado não nasce.

Mais um **índice vivo** das user stories via bloco DataviewJS, que lê os mesmos campos `**Status:**` e `**Épico:**` que o Kanban já lê, com os mesmos regexes. Sem migrar formato, sem tocar em `kanban-server.js`.

---

## Decisões

### Vault em `docs/`, não na raiz do repo

O Obsidian indexa **todo** arquivo `.md` dentro da pasta do vault, e não tem ignore de verdade (a config "Excluded files" só *downranka* em busca, grafo e backlinks). A raiz do repo tem **808 arquivos `.md` dentro de `node_modules/`** contra 89 nossos — o grafo seria 90% README de dependência.

`docs/` é limpo por construção: 79 arquivos, todos nossos. Custo: `CLAUDE.md` e `AGENTS.md` ficam de fora do grafo. Aceitável — são instruções de agente, não documentos que linkamos entre si.

### O Claude instala; a UI só confirma

A instalação é automatizável quase inteira, porque tudo que o Obsidian lê é arquivo em disco:

- O app vem do `winget` (pacote oficial `Obsidian.Obsidian`).
- Um plugin de comunidade **não precisa da loja**: é uma pasta `.obsidian/plugins/<id>/` com `main.js`, `manifest.json` e `styles.css`. Baixar os três do release e escrever `community-plugins.json` com `["dataview"]` é exatamente o que o botão "Install" faz.
- As opções do plugin ficam em `.obsidian/plugins/dataview/data.json`. `enableDataviewJs` é uma chave de arquivo, não um segredo da UI.

Sobra **um** passo de GUI: se o Obsidian abrir o vault em *Restricted Mode*, plugin de comunidade não roda até você desligar (Settings → Community plugins → *Turn on community plugins*). Um clique, uma vez, nunca mais. Fica com você porque é um diálogo de confiança — a ferramenta pergunta de propósito, e responder por você derrota o propósito.

### `data.json` do Dataview não é versionado

`enableDataviewJs: true` vive dentro de `docs/.obsidian/plugins/dataview/`, que é ignorado pelo git junto com o código do plugin. Consequência: **em máquina nova, reinstalar o plugin e religar JS queries.**

Desversionar só esse arquivo exigiria 4 linhas de `.gitignore` com negação (não dá para re-incluir arquivo cujo diretório-pai está excluído, então seria `plugins/*` + `!plugins/dataview/` + `plugins/dataview/*` + `!.../data.json`). Não vale para um projeto de uma máquina. O `docs/README.md` documenta o passo; se um dia houver segunda máquina, a negação é a saída.

### Convivência com o Kanban: o parser é imune, a concorrência não

Verificado contra as regexes de `kanban-server.js`, não deduzido:

| Mudança desta story | Efeito no Kanban | Por que |
|---|---|---|
| `user-stories.md` novo na mesma pasta | nenhum | `/^US-.*\.md$/` não casa `user-stories.md`, nem com `/i` |
| Rename de `.md` pelo Obsidian | nenhum | `acharArquivo()` identifica a story pelo **conteúdo** (`# US-75 — …`, linha 41), não pelo filename |
| `docs/.obsidian/` criado | nenhum | o vault fica em `docs/`; `REQ_DIR` é `docs/sdlc/01-requisitos` |
| Links reescritos por `alwaysUpdateLinks` | nenhum | o Kanban só lê e grava a linha `**Status:**` |
| Arquivo convertido para CRLF | nenhum (só ruído de diff) | `\r` é LineTerminator em JS: `.` não casa, `$` para antes. Leitura sem `\r`, gravação preserva EOL |
| Arquivo gravado com BOM | **degrada** | `^#` não casa na linha 1: card mostra filename em vez de título. Status continua certo |

O risco que **não** é de parser: depois desta story o Obsidian também escreve nesses arquivos, e `gravarStatus` faz read-modify-write sem lock (`kanban-server.js:87-91`). Arrastar um card com o `.md` aberto e sujo no Obsidian pode fazer o buffer dele sobrescrever a linha recém-gravada. Na prática o Obsidian recarrega mudança externa e converge — a regra barata é não fazer as duas coisas ao mesmo tempo, e ela vai para o `docs/README.md`.

Isso reforça a decisão de **não** migrar para frontmatter: como campo YAML, `**Status:**` passaria a ser editável pelo painel de propriedades do Obsidian, e os dois escritores brigariam pelo mesmo *campo*, não só pelo mesmo arquivo. Formato que o Obsidian não reconhece como campo é formato que ele não tem motivo para tocar.

### Dataview lendo `**Status:**` direto, sem migrar para frontmatter

A sintaxe de campo do Dataview é `Chave:: valor` ou YAML frontmatter. O nosso formato (`**Status:** ✅ Implementada`) não é campo em nenhuma das duas.

Migrar os 61 arquivos para frontmatter daria consultas DQL nativas — mas quebraria `kanban-server.js`, que casa `/^\*\*Status:\*\*.*$/m` na leitura **e reescreve essa linha exata** no drag-and-drop (`kanban-server.js:88-91`). Seriam 61 arquivos migrados + o parser e o gravador do Kanban reescritos.

Um bloco **DataviewJS** lê o conteúdo cru com `dv.io.load()` e aplica os mesmos regexes. Zero migração, Kanban intacto, mesmo resultado na tela. Se algum dia as consultas ficarem lentas ou fizerem falta filtros DQL nativos, a migração para frontmatter continua disponível — é a saída de emergência, não o ponto de partida.

---

## Escopo

### Dentro do escopo

- **Instalação do Obsidian** via `winget install Obsidian.Obsidian`.
- **Instalação do Dataview** por arquivo: baixar `main.js`, `manifest.json` e `styles.css` do release para `docs/.obsidian/plugins/dataview/`, e escrever `docs/.obsidian/community-plugins.json` com `["dataview"]`.
- **`enableDataviewJs: true`** escrito em `docs/.obsidian/plugins/dataview/data.json` antes da primeira abertura do vault.
- `docs/.obsidian/app.json` versionado com as três configurações de link (formato Markdown, path relativo, atualização automática).
- `docs/.obsidian/core-plugins.json` com **Backlinks**, **Outgoing links** e **Graph view** ligados.
- Entradas no `.gitignore` para o estado volátil do vault (`workspace.json`) e para o código de plugin de terceiros (`plugins/`).
- `docs/sdlc/01-requisitos/user-stories.md` **recriado** como índice vivo: um bloco `dataviewjs` que lista código, título, épico e status de cada `US-*.md`, ordenado decrescente. Resolve o link legítimo da US-31 que aponta para ele.
- **Repontar os 7 links cujo texto nomeia uma story mas cujo alvo é o índice** — 5 para os arquivos reais de `US-27`/`US-28`, 2 (`US-07`, `US-09`) para `(#)`, que não têm arquivo. Ver *Questões em aberto* #2: recriar o índice sozinho faria esses 7 resolverem **para o documento errado**, o que é pior que quebrado.
- Seção curta no `docs/README.md` (ou o criar) explicando: instalar Dataview, ligar "JavaScript Queries", abrir `docs/` como vault, e a **regra dos dois escritores** (Kanban e Obsidian agora escrevem nos mesmos arquivos — ver *Convivência com o Kanban*).
- Correção dos 4 links de `.md` renomeado listados no Contexto, usando o próprio autocomplete do vault.
- **O link para `evals/reports/2026-07-10.md`** (o 6º alvo da tabela do Contexto) vira **code span, sem link** em `US-17`. É artefato gerado e gitignored pela US-36: não existe no repo de ninguém, então não há alvo para apontar. Manter como link seria manter um quebrado permanente no gate.
- **`scripts/check-doc-links.mjs` + `pnpm docs:links`** — a varredura que os critérios de aceite desta story e da US-79 cobram. Sem deps, sem framework. Ver *Varredura*.

### Fora do escopo

- **Os 85 links quebrados que apontam para código** (82 de profundidade + 3 sem candidato). Independente do Obsidian, que não indexa TypeScript — é a [US-79](./US-79-consertar-links-quebrados-na-documentacao.md).
- **Migrar `**Status:**` para YAML frontmatter** e reescrever o parser do Kanban. Ver *Decisões*.
- **Substituir o quadro Kanban (US-31).** Os dois coexistem: o Kanban edita status por arraste, o índice Dataview é leitura. Nada é apagado.
- **Vault na raiz do repo**, ou qualquer tentativa de trazer código `.ts` para o grafo do Obsidian. Isso é trabalho de outra ferramenta.
- Plugins além do Dataview (Templater, Kanban plugin, Excalidraw). Um plugin de cada vez.
- Publicar o vault (Obsidian Publish / Sync). Local, versionado por git.

---

## Instalação

> Estado verificado em 26/07/2026 nesta máquina: Obsidian **não instalado** (`%LOCALAPPDATA%\Obsidian\`, `Program Files\Obsidian\` e uninstall do `HKCU` todos vazios), `docs/.obsidian/` inexistente, `.gitignore` sem entradas de Obsidian. `winget` v1.29.280 presente.

> **Correções da execução (26/07/2026).** Duas coisas que esta seção previa errado, corrigidas contra o resultado real:
>
> - **O caminho de instalação é `%LOCALAPPDATA%\Programs\Obsidian\Obsidian.exe`**, não `%LOCALAPPDATA%\Obsidian\`. O que fica em `%LOCALAPPDATA%\Obsidian\` é o `obsidian-updater`. O critério de aceite abaixo foi reancorado no caminho real.
> - **O release `0.5.70` do Dataview embarca um `manifest.json` que diz `"version": "0.5.68"`** — descompasso do próprio upstream (a tag foi cortada sem bumpar o manifest). Os bytes vêm da URL da tag `0.5.70`; a versão que o Obsidian vai exibir é `0.5.68`. O critério cobra `"id": "dataview"`, que é o que identifica o plugin.
> - O instalador do Obsidian **falha com `0xC0000005` (access violation)** se rodado dentro do sandbox de comandos do Claude Code. Rodar fora do sandbox instala normal.

**A ordem é obrigatória, não sugestão.** Os passos 2 e 3 escrevem arquivos que o Obsidian carrega no boot do vault e mantém em memória — fazer depois de abrir significa ver o Obsidian sobrescrever o que você escreveu no próximo save dele.

### Passo 1 — app (Claude executa)

```powershell
winget install --exact --id Obsidian.Obsidian --accept-package-agreements --accept-source-agreements
```

Instala por usuário em `%LOCALAPPDATA%\Programs\Obsidian\` — sem UAC. Versão instalada em 26/07/2026: `1.12.7`.

Verificação: `Test-Path "$env:LOCALAPPDATA\Programs\Obsidian\Obsidian.exe"` devolve `True`.

### Passo 2 — Dataview por arquivo (Claude executa)

Plugin de comunidade é só uma pasta. Versão fixada em `0.5.70` (release corrente em 26/07/2026); os três assets são o release completo.

```powershell
$dst = "docs\.obsidian\plugins\dataview"
New-Item -ItemType Directory -Force $dst | Out-Null
$base = "https://github.com/blacksmithgu/obsidian-dataview/releases/download/0.5.70"
foreach ($f in @("main.js","manifest.json","styles.css")) {
  Invoke-WebRequest -Uri "$base/$f" -OutFile "$dst\$f"
}
```

> **Download é ação que pede confirmação.** Uma sessão do Claude vai perguntar antes de baixar os três arquivos (`main.js` ~1 MB, `manifest.json` <1 KB, `styles.css` ~10 KB, de `github.com/blacksmithgu/obsidian-dataview`). Esperado — não é erro.

`docs/.obsidian/community-plugins.json` (versionado — é a lista, não o código):

```json
["dataview"]
```

Verificação: os três arquivos existem e `manifest.json` tem `"id": "dataview"`. **Não cobre `"version": "0.5.70"`** — o release `0.5.70` embarca um manifest que diz `0.5.68` (ver *Correções da execução*, acima).

### Passo 3 — JavaScript Queries por arquivo (Claude executa)

`docs/.obsidian/plugins/dataview/data.json`. As duas chaves nascem `false` no código do plugin (`src/settings.ts`); sem elas o bloco `dataviewjs` do índice renderiza como código cru.

```json
{
  "enableDataviewJs": true,
  "enableInlineDataviewJs": true
}
```

> **Escreva só o que precisa mudar.** O Dataview mescla esse objeto sobre os defaults dele no load — não montar o `data.json` inteiro à mão, senão a próxima versão do plugin ganha chaves novas que este arquivo congela em valor velho.

### Passo 4 — Restricted Mode (você, um clique)

Abrir `docs/` como vault (`Open folder as vault`). Se o Obsidian abrir em Restricted Mode, plugin de comunidade não roda: **Settings → Community plugins → Turn on community plugins**.

É o único passo de GUI da story, e fica com você de propósito: é um diálogo de confiança sobre executar código de terceiro no seu vault. Uma vez por vault.

Verificação: Settings → Community plugins mostra Dataview ativo, e Settings → Dataview mostra *Enable JavaScript Queries* ligado (veio do passo 3, não de clique).

### O que o Claude **não** faz

| Não faz | Por que |
|---|---|
| Clicar o "Turn on community plugins" | Diálogo de confiança; responder por você anula o sentido dele |
| Rodar o teste de regressão de rename (aceite) | Rename é operação do Obsidian dentro do app; é o comportamento sob teste |
| Conferir Graph view / Unresolved links / autocomplete | Critérios observacionais — só existem na tela |

Tudo que é arquivo versionado (`app.json`, `core-plugins.json`, `.gitignore`, `user-stories.md`, os 4 links renomeados, `docs/README.md`) o Claude escreve sem o app instalado. O app é necessário para **verificar**, não para produzir.

---

## Configuração proposta

`docs/.obsidian/app.json`:

```json
{
  "useMarkdownLinks": true,
  "newLinkFormat": "relative",
  "alwaysUpdateLinks": true
}
```

| Chave | Efeito | Por que |
|---|---|---|
| `useMarkdownLinks: true` | Escreve `[texto](caminho.md)` em vez de `[[wikilink]]` | Wikilink **não renderiza no GitHub**; os 620 links atuais já são Markdown |
| `newLinkFormat: "relative"` | Path relativo ao arquivo atual | Casa com o padrão existente (`./US-XX-....md`, `../adr/00X-....md`) |
| `alwaysUpdateLinks: true` | Renomear reescreve os links que apontam para o arquivo | **É o ganho principal desta story** |

> Se qualquer chave não pegar, configurar pela UI: **Settings → Files & Links**. A UI é a fonte de verdade; o JSON é só o que ela grava.

Adições ao `.gitignore`:

```gitignore
# US-78: estado de UI do vault Obsidian (churn a cada scroll) e plugins de terceiros
docs/.obsidian/workspace.json
docs/.obsidian/appearance.json
docs/.obsidian/plugins/
```

> **`appearance.json` foi acrescentado na execução.** A US previa duas entradas; o Obsidian
> criou uma terceira (tema/fonte) na primeira abertura do vault. É estado de UI como o
> `workspace.json`, então ignorado pelo mesmo motivo. `core-plugins.json` **é** reescrito na
> abertura — o Obsidian expande as 11 chaves escritas à mão para a lista completa dele —
> mas isso é conteúdo de projeto, e continua versionado.

`app.json`, `core-plugins.json` e `community-plugins.json` **entram** no repo — são configuração de projeto.

---

## Índice vivo (`user-stories.md`)

```dataviewjs
const files = dv.pages('"sdlc/01-requisitos"')
  .where(p => /^US-\d+/.test(p.file.name) && p.file.name !== "US-TEMPLATE");

const rows = [];
for (const p of files) {
  const raw = await dv.io.load(p.file.path);
  const pega = (re) => (raw.match(re) || [, ""])[1].trim();
  rows.push([
    p.file.link,
    pega(/^\*\*Épico:\*\*\s*(.+)$/m),
    pega(/^\*\*Status:\*\*\s*(.+)$/m),
  ]);
}

rows.sort((a, b) => b[0].path.localeCompare(a[0].path, undefined, { numeric: true }));
dv.table(["Story", "Épico", "Status"], rows);
```

Os dois regexes são **os mesmos** de `kanban-server.js:43-44`. Se o formato do cabeçalho mudar um dia, os dois quebram juntos e de forma visível — melhor que divergirem em silêncio.

---

## Varredura (`pnpm docs:links`)

`scripts/check-doc-links.mjs`. Node puro, sem dependência — os números do Contexto vinham de medição à mão, e critério de aceite que ninguém consegue re-rodar é critério baseado em confiança.

```bash
pnpm docs:links                 # falha se houver QUALQUER quebrado  (gate da US-79)
pnpm docs:links --only-md       # falha só nos .md + ambíguos        (gate desta story)
pnpm docs:links --list          # imprime cada link quebrado, com a correção sugerida
pnpm docs:links --naive         # mostra também a contagem ingênua do sufixo :NN
```

Saída em `2ac79f6` — reproduz a tabela do Contexto linha por linha:

```
docs/: 83 arquivos .md
Links relativos totais: 634
Quebrados: 101
  profundidade errada, resolução única :  82  (US-79)
  alvo não existe, aponta p/ código    :   3  (US-79)
  alvo não existe, aponta p/ .md       :  16  (US-78)
  ambíguos (>1 candidato)              :   0
Contagem ingênua (sufixo :NN como path): 107  (= 101 + 6)
```

No estado de hoje (com US-77 a US-80 no disco, ainda não commitados): 87 arquivos e **103** quebrados — `82 / 3 / 18 / 0`. O total de links não vale fixar aqui: sobe a cada parágrafo escrito, inclusive por editar esta própria US. Rode o script. Os 2 `.md` a mais são da US-77, apontando para os **mesmos** alvos mortos `US-29-saneamento-de-rolagens.md` e `US-36-eval-qualidade-narracao.md` já tabelados no Contexto. Continuam 6 alvos; mais links mirando neles.

### Decisões do script

| Decisão | Por que |
|---|---|
| **Ignora code fence e code span** | `` `[texto](./US-XX-....md)` `` em prosa é sintaxe ilustrada, não link. Sem isso a própria US-78 gera 3 falsos positivos e o gate nunca fecha. Blanka as linhas em vez de removê-las, para o número de linha do relatório continuar certo |
| **Sufixo `:NN` / `:NN-MM` strippado** | Convenção `file:line` do `CLAUDE.md`. `kanban-server.js:88-91` é link válido para um arquivo que existe |
| **Varia `../` de 0 a 6 para diagnosticar** | Distingue *path errado* (resolve com outra profundidade → US-79, com a correção impressa) de *alvo inexistente* (não resolve com nenhuma → decisão humana). Se mais de uma profundidade resolver, vai para **ambíguo** e o script não escolhe |
| **`decodeURIComponent` no destino** | 4 arquivos têm espaço/acento no nome; link para eles carrega `%20`. Sem decode, todos apareceriam como falso quebrado |
| **Varre o disco, não `git ls-files`** | É o que o Obsidian indexa, e evita exatamente o bug de `core.quotePath` que produziu o `79` errado. Custo: arquivo novo ainda não commitado já entra na contagem — desejável para pegar link quebrado **antes** do commit |
| **Dois gates em vez de um** | O aceite desta story é "0 quebrados `.md`"; o da US-79 é "0 quebrados". Uma flag, não dois scripts |

Ambíguos entram no gate `--only-md` junto com os `.md`: candidato múltiplo exige decisão humana, e "o script não soube decidir" não é motivo para passar verde.

**Ligar isso no CI é da [US-80](./US-80-ci-typecheck-testes-e-evals.md)**, que cria o `.github/workflows/` que hoje não existe. Aqui o script só precisa existir e rodar à mão.

---

## Critérios de aceite

- [x] `Test-Path "$env:LOCALAPPDATA\Programs\Obsidian\Obsidian.exe"` devolve `True` — o app está instalado. *(26/07/2026: `True`, versão 1.12.7. Caminho corrigido — ver *Correções da execução*.)*
- [x] `docs/.obsidian/plugins/dataview/` tem `main.js`, `manifest.json` e `styles.css`, e o `manifest.json` diz `"id": "dataview"`. *(26/07/2026: baixados da tag `0.5.70`; o manifest declara `0.5.68`, descompasso do upstream.)*
- [x] O bloco `dataviewjs` do índice **renderiza como tabela, não como código cru** — prova de que `enableDataviewJs` pegou pelo arquivo, sem ninguém clicar o toggle. *(26/07/2026: tabela na primeira abertura. O vault nem entrou em Restricted Mode — o passo 4 de GUI acabou não sendo necessário nesta máquina.)*
- [x] Abrir `docs/` como vault e ativar Graph view mostra os documentos ligados pelos links relativos existentes (não um grafo de nós soltos). *(26/07/2026: confirmado na tela.)*
- [x] ~~O painel **Unresolved links** lista os alvos mortos conhecidos~~ — **critério vencido pela própria story.** *(Fechado pelo `pnpm docs:links --only-md` = 0 quebrados `.md`, que é a mesma pergunta em forma re-executável; o painel em si não foi aberto.)* Foi escrito antes da correção; os 5 alvos que ele mandava procurar (`user-stories.md`, `US-29-saneamento-de-rolagens.md`, `US-36-eval-qualidade-narracao.md`, `US-45-background-visivel-na-ficha.md`, `US-67-edicao-de-turno.md`) **não existem mais como link**. O que vale conferir agora é o inverso: o painel **não** lista nenhum `.md`. O que sobrar são os alvos de código da [US-79](./US-79-consertar-links-quebrados-na-documentacao.md), que o Obsidian nem indexa.
- [x] Digitar `[` num documento abre autocomplete e inserir um resultado produz **link Markdown relativo** (`[texto](./arquivo.md)`), nunca `[[wikilink]]`. *(26/07/2026: confirmado na tela.)*
- [x] **Teste de regressão (rename):** renomear `US-75-dimensao-de-proveniencia-no-ledger.md` pelo Obsidian faz o link na linha 6 de `US-76-consertar-fake-teste-extractOpeningEntities.md` apontar para o novo nome sozinho. `git diff` mostra **só** a mudança de link — nenhuma reformatação de corpo, nenhuma mudança de encoding, nenhum fim de linha alterado. Desfazer o rename ao final.

  *(26/07/2026: feito com **`US-11b` → `US-11`**, cobaia melhor que a prevista — tinha 11 links entrantes em 7 arquivos, incluindo um `../` de fora da pasta (`docs/adr/002`). Todos reescritos sozinhos. `git diff --numstat` deu `1 1` / `2 2` / `3 3` — só as linhas de link. Sem BOM (`23 20 55`), sem CRLF.)*

  **Três comportamentos que o teste revelou, nenhum previsto na US:**

  1. **O Obsidian tira o `./` de links no mesmo diretório.** `[US-11b](./US-11b-….md)` virou `[US-11b](US-11-….md)`. É o `newLinkFormat: "relative"` — relativo puro. Continua válido no GitHub e o `check-doc-links.mjs` resolve os dois iguais (`resolve(dir, target)`), então não é bug; é só divergência de convenção com os ~600 links escritos à mão com `./`. Links `../` para fora da pasta **mantêm** o prefixo.
  2. **O texto do link não é tocado, só o path.** `[US-11b](US-11-….md)` — o rótulo continua dizendo `US-11b`. Correto pelo critério ("só a mudança de link"), mas significa que renomear o **código** de uma story deixa os rótulos mentindo, e isso é trabalho manual.
  3. **O título dentro do arquivo também não muda** (`# US-11b — …` intacto). Confirma na prática a linha da tabela de *Convivência com o Kanban*: `acharArquivo()` identifica a story pelo conteúdo, então o card continua sendo `US-11b` e o Kanban não percebe rename nenhum.

  **Desfazer o rename é mais chato do que parece.** `git checkout --` restaura o arquivo antigo e os links, mas: (a) **não apaga** o arquivo com o nome novo, que fica como untracked — dá dois arquivos com o mesmo conteúdo, e a cópia precisa ser removida à mão; (b) **não alcança arquivo que já estava sujo** por outro motivo — aqui `US-73` tinha edição pendente da própria US-78, então o link reescrito nele sobreviveu ao checkout e virou o único quebrado do gate. Quem pega isso é o `pnpm docs:links --only-md`; sem ele, o link ficaria morto em silêncio. **Rode o gate depois de qualquer rename.** (c) O `git checkout` grava com **CRLF** (`core.autocrlf=true` + `.gitattributes text=auto`), então o arquivo restaurado sai fora do padrão LF do resto do working tree — inofensivo para o git e para o Kanban, mas vale normalizar.
- [x] `user-stories.md` renderiza a tabela mostrando, para cada story, o mesmo `**Status:**` que está no arquivo dela. *(26/07/2026: conferido na tela.)*
- [x] Os 8 links que apontam para `user-stories.md` deixam de aparecer como não resolvidos. *(7 repontados — 5 para os arquivos reais de US-27/US-28, 2 para `(#)`; o 8º, em `US-31:23`, resolve agora que o índice existe.)*
- [x] Os 4 alvos de `.md` renomeado do Contexto são corrigidos. **Invariante, independente da ordem em relação à [US-79](./US-79-consertar-links-quebrados-na-documentacao.md):** `pnpm docs:links --only-md` **sai com código 0**. Quebrados que apontam para código não contam aqui — são da US-79. (Para conferência no `pnpm docs:links` completo: se a US-79 ainda não rodou, restam 85 quebrados; se já rodou, 0.) *(26/07/2026: `--only-md` sai 0; o completo mostra `82 / 3 / 0 / 0` = os 85 da US-79, exatamente como previsto.)*
- [x] `pnpm docs:links --naive` roda sem dependência instalada e, num checkout de `2ac79f6`, reproduz a tabela do Contexto: `634` links, `101` quebrados, `82 / 3 / 16 / 0`, ingênua `107`. É o que torna os dois critérios acima verificáveis por outra pessoa. *(26/07/2026: verificado num `git worktree --detach 2ac79f6` com o script copiado por cima — saída idêntica, linha por linha.)*
- [x] `git status` após abrir e navegar o vault não mostra ruído — só os arquivos que a story mudou de propósito. Confirma que os ignores estão certos. *(26/07/2026, **depois** da primeira abertura: os únicos untracked em `docs/.obsidian/` são `app.json`, `community-plugins.json` e `core-plugins.json`. `workspace.json` e `appearance.json`, ambos criados pelo Obsidian na abertura, caem no ignore.)*
### O Kanban (US-31) continua funcionando

Os 4 primeiros já foram verificados contra as regexes reais de `kanban-server.js` antes de escrever este critério — estão aqui para pegar regressão, não como incógnita.

- [x] `tools/kanban/kanban.bat` sobe e o número de cards **é igual** ao número de linhas da tabela do índice Dataview. Relação, não número fixo: as duas views aplicam o mesmo filtro (`/^US-.*\.md$/` menos `US-TEMPLATE.md`), então divergência é bug de uma das duas. *(26/07/2026: **66 = 66**. `GET /stories` devolve 66; rodar o filtro do Dataview (`/^US-\d+/` sobre `file.name`) sobre a mesma pasta devolve os mesmos 66, com diferença simétrica vazia.)*
- [x] **`user-stories.md` não aparece como card.** O filtro do kanban não casa `user-stories.md` — nem com flag `/i`, porque o terceiro caractere teria que ser `-` e é `e`. O índice é invisível ao Kanban por construção, não por sorte de maiúscula. *(26/07/2026: confirmado, na lista e na tela.)*
- [x] **Arrastar um card reescreve só a linha `**Status:**`:** `git diff --numstat` no arquivo mostra `1 1`. Nada de reformatação de corpo, nada de link reescrito de carona. *(26/07/2026: `PATCH /stories/US-74 {"coluna":"doing"}` num arquivo limpo → `1	1`. Revertido em seguida; `git diff` do arquivo volta a zero linhas.)*
- [x] **Os cards mostram o título real, não o nome do arquivo.** É o detector de BOM: se o Obsidian gravar UTF-8 com BOM, `^#` deixa de casar na linha 1 (`kanban-server.js:39`), o parser cai no fallback do filename e **o status continua certo** — falha silenciosa que só o título denuncia. *(26/07/2026: títulos reais na tela; nenhum `.md` de `docs/` começa com BOM.)*
- [x] Nenhum `.md` de `docs/` virou CRLF (`git diff` sem `^M`). Verificado que as regexes do Kanban **sobrevivem** a CRLF: em JS `\r` é LineTerminator, então `.` não casa com ele e `$` com `/m` para antes — a leitura sai sem `\r` e a gravação preserva o EOL. Ou seja, CRLF aqui é ruído de diff, não quebra funcional. *(26/07/2026: o único caso de CRLF na sessão **não veio do Obsidian nem do Kanban** — veio do `git checkout` que desfez o rename, com `core.autocrlf=true`. Normalizado; working tree todo em LF.)*
- [x] A **regra dos dois escritores** está no `docs/README.md`: não arrastar card enquanto o mesmo `.md` está aberto com edição não salva no Obsidian. Depois desta story o Kanban não é mais o único a escrever nesses arquivos, e `gravarStatus` faz read-modify-write sem lock (`kanban-server.js:87-91`).

---

## Notas de implementação

> *Dicas, não especificação obrigatória.*

- **Ordem de execução:** configurar os links **antes** de renomear qualquer coisa. Renomear com `alwaysUpdateLinks` desligado é o mesmo comportamento que causou os 16 links mortos.
- **Encoding:** os `.md` são UTF-8 e o cabeçalho usa em-dash (`—`) e emoji. Conferir no primeiro `git diff` que o Obsidian não converteu para CRLF nem trocou o encoding — o teste de regressão do rename cobre isso.
- **DataviewJS nasce desligado** (`enableDataviewJs: false` no `src/settings.ts` do plugin). O passo 3 da *Instalação* liga por arquivo; o equivalente na UI é Settings → Dataview → *Enable JavaScript Queries*, útil como conferência. Sem isso o bloco aparece como código cru.
- **Se o passo 3 não pegou**, quase sempre é ordem: o `data.json` foi escrito com o vault já aberto e o Obsidian sobrescreveu. Fechar o Obsidian, reescrever, reabrir.
- **Versão do Dataview fixada em `0.5.70`.** Se um dia atualizar pela loja, o `manifest.json` local muda e esta US fica desatualizada — mas `data.json` sobrevive à atualização, então JS queries continuam ligadas.
- O bloco DataviewJS é código que roda dentro do vault. É o nosso próprio arquivo, no nosso repo — mas vale saber que a linha entre "documento" e "código executável" some ao ligar JavaScript Queries.
- `dv.io.load()` é assíncrono e lê os ~61 arquivos um a um. É instantâneo nessa escala; se um dia passar de alguns milhares, é o sinal de migrar para frontmatter.
- `p.file.link` já devolve um link clicável; não montar o link à mão.

---

## Questões em aberto

> **Nenhuma bloqueia a implementação — as 4 estão respondidas.** Ficam registradas com o motivo, não apagadas: cada uma mudou o escopo.

### 1. Onde moram as instruções do vault? — **Resolvida**

**Decidido: criar `docs/README.md`.** Três razões, em ordem de peso:

- O GitHub renderiza `README.md` como página inicial da pasta. Quem navega até `docs/` — que é exatamente o diretório do vault — cai nas instruções sem procurar.
- O Obsidian trata como nota normal: entra no grafo, aparece em busca, aceita link dos outros documentos. Um `AGENTS.md` na raiz não entra (ver *Decisões*).
- `AGENTS.md` e `CLAUDE.md` são instrução de agente. Setup de ferramenta humana ali é ruído para os dois públicos.

Descartado pendurar na própria US-78: spec vira `✅ Implementada` e para de ser lida. Instrução de setup precisa de casa permanente.

### 2. Recriar `user-stories.md` no mesmo caminho? — **Resolvida**

**Decidido: sim, mesmo caminho — mas a premissa desta pergunta estava errada, e isso adicionou um item ao escopo.**

A US dizia que recriar o índice "reconecta os 8 links órfãos sem editá-los". Não reconecta: **7 dos 8 têm texto que nomeia uma story específica** e alvo apontando para o índice. Eles resolveriam, e passariam a mentir — clicar em `[US-27]` levaria a um índice, não à US-27. Pior que quebrado: o `pnpm docs:links` fica verde e o link continua errado.

O motivo é histórico. A linha 23 da [US-31](./US-31-quadro-kanban-de-user-stories.md) descreve `user-stories.md` como "índice agrupado por épico que não mostra status" — era **um arquivo só** com todas as stories, e `[US-27](./user-stories.md)` apontava para uma seção dele. As stories foram fatiadas em arquivos; os links para o monolito ficaram.

| Link | Quantos | O que precisa | Por que |
|---|---:|---|---|
| `[US-27]`, `[US-28]` → índice | 5 | **repontar para o arquivo da story** | `US-27-pericias-do-personagem.md` e `US-28-aventura-inicial-baseada-na-classe.md` existem |
| `[US-07]`, `[US-09 — …]` → índice | 2 | **virar `(#)`** | Nenhuma das duas tem arquivo. `(#)` já é convenção no repo (9 usos), e `[US-09](#)` já aparece em outro lugar — hoje a mesma story é linkada de duas formas diferentes |
| `` [`user-stories.md`] `` → índice | 1 | **só recriar o arquivo** | É o único que quer o índice de verdade |

Recriar no mesmo caminho continua certo — resolve o link legítimo e é onde o Dataview já filtra a si mesmo (`dv.pages('"sdlc/01-requisitos"')` + `/^US-\d+/`). Um `docs/INDEX.md` novo não teria vantagem nenhuma e deixaria os 8 apontando para o vazio.

> **Efeito colateral no texto da US-31.** A frase dela diz que o índice "**não mostra status**". O índice novo mostra. Ao recriar, a frase fica falsa — ajustar para o passado, ou a US-31 passa a descrever errado a ferramenta que ela mesma motivou.
### 3. ~~Check de links quebrados no CI?~~ Resolvida

O script existe (`pnpm docs:links`, ver *Varredura*) porque sem ele dois critérios de aceite — o desta story e o da US-79 — não eram verificáveis. Ligar no workflow é da [US-80](./US-80-ci-typecheck-testes-e-evals.md); nada a decidir aqui.

### 4. Os placeholders `(#)` e os nomes de arquivo sujos — **Resolvida: virou a [US-81](./US-81-higiene-de-nomes-e-placeholders-nos-docs.md)**

Levantada ao investigar a #2. Não é link quebrado (o `pnpm docs:links` ignora alvo `#` de propósito), então **a US-79 também não cobre** — precisava de story própria. Os dois achados:

- **`(#)` usado para story que tem arquivo.** 9 ocorrências, 5 códigos; **6 delas** apontam para o vazio tendo arquivo (`US-01`, `US-02`, `US-18`). As outras 3 estão certas — `US-09` e `US-24` nunca ganharam arquivo.
- **3 nomes de arquivo fora da convenção** que os outros 61 seguem, um com erro de digitação no nome: `US-01-atritbutos personagem.md`, `US-02-inventário personagem.md`, `US-43-calibracao-peso-traços-identidade.md`.

**Decidido: depois desta story, não dentro.** É o trabalho que a US-78 torna seguro — com `alwaysUpdateLinks`, renomear reescreve os 5 links percent-encoded sozinho. Fazer antes é repetir à mão o que esta story automatiza. A US-81 registra isso como dependência recomendada, não bloqueante.

---

## Referências no código

- `docs/sdlc/01-requisitos/US-*.md` — 61 rastreados (65 no disco com as stories novas); fonte de verdade de título, `**Status:**` e `**Épico:**`.
- `docs/sdlc/01-requisitos/US-TEMPLATE.md` — molde do cabeçalho; excluído do índice, como já é no Kanban.
- `tools/kanban/kanban-server.js:43-44` — regexes de `**Status:**` e `**Épico:**` que o bloco DataviewJS reusa.
- `tools/kanban/kanban-server.js:88-91` — gravação da linha `**Status:**`; é o que a migração para frontmatter quebraria.
- `docs/adr/` — 6 ADRs, alvo dos links entre requisitos e decisões; entram no mesmo grafo.
- `.gitignore` — recebe as duas entradas do vault.
- `scripts/check-doc-links.mjs` (a criar) — a varredura. `.mjs` sem deps, igual a `scripts/srd/sync.mjs` e `ingest.mjs` (o repo não declara `"type": "module"`).
- `package.json` — recebe `"docs:links": "node scripts/check-doc-links.mjs"`.
- `docs/.obsidian/app.json` (a criar) — configuração de link versionada.
- `docs/.obsidian/core-plugins.json` (a criar) — Backlinks, Outgoing links, Graph view. **Core, já vêm no app** — este arquivo só liga, não instala.
- `docs/.obsidian/community-plugins.json` (a criar) — `["dataview"]`. Versionado: é a lista de plugins ativos, não o código deles.
- `docs/.obsidian/plugins/dataview/` (a baixar, **gitignored**) — `main.js`, `manifest.json`, `styles.css` do release `0.5.70`.
- `docs/.obsidian/plugins/dataview/data.json` (a criar, **gitignored** junto com a pasta) — `enableDataviewJs`. Ver *Decisões*: reinstalação manual por máquina nova.
- `docs/sdlc/01-requisitos/user-stories.md` (a recriar) — índice vivo.
- `docs/README.md` (a criar) — instruções de setup do vault, incluindo o passo 4 de GUI e a nota de máquina nova.
