// US-98: dicionário pt-BR da interface. É RECORTE do que já estava no JSX, não
// redação nova — com uma correção deliberada: o "tu/teu" da tela de login e do
// wizard virou "você", alinhando a UI com a regra que o prompt do Mestre já impõe
// à narração (`dm-system.ts`: usar "você", nunca "tu").
//
// Chave por tela/componente (`setup.system.titulo`), nunca derivada do texto: chave
// derivada do texto muda toda vez que o texto muda. O objeto é CHATO (chaves com
// ponto, não aninhamento) porque é isso que faz `keyof typeof ptBR` funcionar sem
// ginástica de tipo — e é ele que transforma typo de chave em erro de compilação.
//
// Frase inteira com placeholder `{x}`, nunca concatenação: `t('etapa') + n + t('de')`
// quebra em qualquer idioma com outra ordem de palavras.
export const ptBR = {
  // ---- comum a todas as telas ----
  'common.appName': 'Mestre da Crônica',
  'common.skipLink': 'Pular para o conteúdo',
  'common.signOut': 'Sair',
  'common.retry': 'Tentar de novo',
  'common.theme.toLight': 'Mudar para modo claro',
  'common.theme.toDark': 'Mudar para modo noturno',
  'common.locale.group': 'Idioma da mesa',

  'meta.title': 'Mestre da Crônica',
  'meta.description': 'Seu narrador de RPG movido a IA',

  // ---- login ----
  'login.subtitle': 'Entre com a sua conta para os seus personagens seguirem você em qualquer dispositivo.',
  'login.google': 'Entrar com Google',

  // ---- home / hub ----
  'home.empty.title': 'Olá, Aventureiro',
  'home.empty.none': 'Você ainda não tem nenhum personagem.',
  'home.empty.hint': 'Crie seu primeiro personagem para começar a jogar.',
  'home.empty.create': 'Criar meu personagem',
  'home.loading': 'Carregando seus personagens…',
  'home.error.load': 'Não foi possível carregar seus personagens.',
  'home.error.delete': 'Não foi possível deletar o personagem. Tente de novo.',
  'home.welcomeBack': 'Bem-vindo de volta, Aventureiro.',
  'home.level': 'Nv.{level}',
  'home.adventureLabel': 'Aventura:',
  'home.continue': 'Continuar jogando',
  'home.noAdventure': 'Nenhuma aventura em andamento',
  'home.newCharacter': 'Criar novo personagem',
  'home.delete': 'Deletar {name}',
  'home.confirmDelete': 'Deletar {name}? Esta ação não pode ser desfeita.',
  'home.showAll': 'Ver todos os personagens',

  // ---- wizard: trilha de etapas ----
  'setup.progress': 'Progresso',
  'setup.stepOf': 'Etapa {n} de {total} — {label}',
  'setup.step.system': 'Sistema',
  'setup.step.race-class': 'Raça/Classe',
  'setup.step.attributes': 'Atributos',
  'setup.step.skills': 'Perícias',
  'setup.step.background': 'Background',
  'setup.step.review': 'Revisão',
  'setup.step.world': 'Mundo',
  'setup.back': 'Voltar',
  // US-107: saída da criação. "Voltar" (rodapé) anda uma etapa; este sai da tela —
  // por isso o rótulo nomeia o DESTINO, e não repete o verbo sozinho.
  'setup.exit': 'Voltar aos personagens',
  'setup.next': 'Próximo',
  'setup.confirming': 'A criar...',
  // US-157: sétimo passo, depois de `review` — cenário/tom/tipo de área da aventura.
  'setup.world.titulo': 'O mundo da aventura',
  'setup.world.subtitulo': 'Escolha cenário, tom e tipo de área — ou deixe cada um no Aleatório.',
  'setup.world.setting': 'Cenário',
  'setup.world.tone': 'Tom',
  'setup.world.areaType': 'Tipo de área',
  'setup.world.random': 'Aleatório',
  'setup.world.start': 'Criar aventura',
  'setup.world.starting': 'Criando aventura...',

  // ---- wizard: sistema ----
  'setup.system.titulo': 'Escolha o Sistema',
  'setup.system.subtitulo': 'Define as regras que guiarão a sua jornada.',
  'setup.system.loading': 'Carregando sistemas...',
  'setup.system.error': 'Não foi possível carregar os sistemas. Recarregue a página.',
  'setup.system.hint.FREE': 'Narração livre, sem sistema oficial',
  'setup.system.hint.SRD': 'Regras oficiais de um sistema conhecido',
  'setup.system.hint.UPLOAD': 'Sistema customizado enviado por um usuário',

  // ---- wizard: raça e classe ----
  'setup.raceClass.titulo': 'Raça e Classe',
  'setup.raceClass.system': 'Sistema: {name}',
  'setup.raceClass.name': 'Nome do personagem',
  'setup.raceClass.namePlaceholder': 'Ex.: Lyra Silvermoon',
  'setup.raceClass.gender': 'Gênero',
  'setup.raceClass.race': 'Raça',
  'setup.raceClass.class': 'Classe',
  'setup.raceClass.select': 'Selecionar…',

  // Rótulos de gênero. O VALOR enviado à API continua sendo o texto PT (ver SetupWizard):
  // gênero não é dado de SRD, não tem catálogo de onde vir.
  // US-105: `setup.race.*` e `setup.class.*` saíram daqui — o rótulo de raça e de classe
  // agora vem do catálogo do sistema (config), já no locale ativo, e não do dicionário da UI.
  'setup.gender.Feminino': 'Feminino',
  'setup.gender.Masculino': 'Masculino',
  'setup.gender.Não-binário': 'Não-binário',

  // ---- wizard: atributos ----
  'setup.attributes.titulo': 'Atributos',
  'setup.attributes.remaining': 'Pontos restantes:',
  'setup.attributes.decrease': 'Diminuir {label}',
  'setup.attributes.increase': 'Aumentar {label}',
  // US-123: bônus de atributo do background (grant.kind === 'ability').
  'setup.attributes.abilityBanner': '{origin} concede +1 fixo em {attr} e +1 bônus — escolha outro atributo abaixo.',
  'setup.attributes.abilityBadgeFixed': '+1 origem',
  'setup.attributes.abilityBadgeGhost': '+1 bônus',

  // ---- wizard: perícias ----
  'setup.skills.titulo': 'Perícias',
  // US-131: seção das perícias do background, no TOPO desta etapa (a origem já avisou na
  // etapa `background`; aqui é onde a escolha de fato acontece).
  'setup.skills.originGrant': 'Perícias de {origin}',
  'setup.skills.instructions': 'Escolha {n} perícias proficientes (+{bonus} cada).',
  'setup.skills.selected': 'Selecionadas:',

  // ---- wizard: background ----
  'setup.background.titulo': 'Background',
  'setup.background.subtitulo': 'Quem é {name}? O mestre usa isto para dar peso às escolhas. Tudo opcional — um item por linha em ideais, vínculos e fraquezas.',
  'setup.background.defaultName': 'o personagem',
  'setup.background.story': 'História',
  'setup.background.storyPlaceholder': 'Ex.: nobre menor que perdeu a família para um culto demoníaco…',
  'setup.background.ideals': 'Ideais — um por linha',
  'setup.background.idealsPlaceholder': 'Ex.: Justiça acima de tudo',
  'setup.background.bonds': 'Vínculos — um por linha',
  'setup.background.bondsPlaceholder': 'Ex.: Jurou vingança contra o culto que matou sua família',
  'setup.background.flaws': 'Fraquezas — uma por linha',
  'setup.background.flawsPlaceholder': 'Ex.: Código de honra rígido: não mente, não abandona inocentes',
  'setup.background.deity': 'Divindade/Patrono — nome, e o que representa',
  'setup.background.deityPlaceholder': 'Ex.: Auril, deusa do inverno',

  // ---- wizard: origem (US-122) ----
  'setup.origin.titulo': 'Origem',
  // US-123: aviso do bônus de atributo, mostrado na etapa `background` (a escolha em si
  // acontece na etapa `attributes` — aqui é só o aviso do que vem a seguir).
  'setup.origin.abilityGrant': '+1 fixo em {attr}, +1 à escolha em outro atributo.',
  'setup.origin.toolGrant': 'Proficiências de {origin}',
  // US-132 (design critique 2026-08-14): rótulo dos <optgroup> do select de ferramenta —
  // só as 4 categorias que hoje aparecem dentro de algum `chooseFrom` (ver TOOL_CATEGORY_ORDER).
  'setup.tools.category.artisan': 'Ferramentas de artesão',
  'setup.tools.category.musical-instrument': 'Instrumentos musicais',
  'setup.tools.category.gaming-set': 'Jogos',
  'setup.tools.category.vehicle': 'Veículos',

  // ---- wizard: conexão e memento (US-124) — título/subtítulo são FIXOS, não vêm do
  // heading/preâmbulo do dataset (frágil a tradução automática, ver US-124 Questão 1/2).
  'setup.origin.connection': 'Conexão',
  'setup.origin.memento': 'Memento',
  'setup.origin.pickHint': 'Escolha na lista, ou sorteie.',
  'setup.origin.random': 'Sortear',

  // ---- wizard: revisão ----
  'setup.review.titulo': 'Revisão',
  'setup.review.subtitulo': 'Confira a sua ficha antes de embarcar na aventura.',
  'setup.review.name': 'Nome',
  'setup.review.gender': 'Gênero',
  'setup.review.race': 'Raça',
  'setup.review.class': 'Classe',
  'setup.review.level': 'Nível',
  'setup.review.hp': 'PV inicial',
  'setup.review.attributes': 'Atributos',
  'setup.review.skills': 'Perícias',
  'setup.review.tools': 'Proficiências',
  'setup.review.kit': 'Kit inicial',
  'setup.review.background': 'Background',
  'setup.review.origin': 'Origem',
  'setup.review.connection': 'Conexão',
  'setup.review.memento': 'Memento',

  // ---- wizard: erros ----
  'setup.error.create': 'Erro ao criar personagem. Tente novamente.',
  'setup.error.start': 'Erro ao iniciar a aventura. Tente novamente.',

  // ---- gancho de aventura inicial ----

  // ---- mesa de jogo ----
  'game.notFound': 'Personagem não encontrado.',
  'game.restart': 'Recomeçar',
  // US-107: no mobile é o nome acessível de um controlo só-ícone — tem de dizer para
  // onde vai sozinho, sem depender da seta.
  'game.exit': 'Voltar aos personagens',
  'game.sheetToggle': 'Ficha — {name}',
  'game.sheetTabs': 'Ficha do personagem',
  'game.tab.ficha': 'Ficha',
  'game.tab.features': 'Features',
  'game.tab.background': 'Background',
  // Sigla igual nos dois idiomas, mas com chave própria: é texto de tela, e a
  // exceção "está em inglês, então pode ficar literal" é a porta por onde a
  // próxima string literal entra.
  'game.hp': 'HP',
  'game.conditions': 'Condições',
  'game.attributes': 'Atributos',
  // Abreviaturas de atributo da ficha. Vivem no front (não no config): são o
  // fallback de 3 letras que a coluna da ficha mostra.
  'game.attr.strength': 'FOR',
  'game.attr.dexterity': 'DES',
  'game.attr.constitution': 'CON',
  'game.attr.intelligence': 'INT',
  'game.attr.wisdom': 'SAB',
  'game.attr.charisma': 'CAR',
  'game.skills': 'Perícias',
  'game.proficient': 'Proficiente',
  'game.tools': 'Proficiências',
  'game.inventory': 'Inventário ({n})',
  'game.inventoryEmpty': 'Nenhum item',
  'game.background.empty': 'Este personagem ainda não tem história.',
  'game.background.origin': 'Origem',
  'game.background.connection': 'Conexão',
  'game.background.memento': 'Memento',
  'game.background.adventures': 'Aventura e Avanço',
  'game.background.story': 'História',
  'game.background.deity': 'Divindade/Patrono',
  'game.background.ideals': 'Ideais',
  'game.background.bonds': 'Vínculos',
  'game.background.flaws': 'Fraquezas',
  'game.features.empty': 'Esta classe ainda não tem features nem magias registradas.',
  'game.features.title': 'Features',
  'game.features.tag.class': 'Classe',
  'game.features.tag.background': 'Origem',
  'game.spells.title': 'Magias',
  'game.log': 'Narração do Mestre',
  'game.empty.title': 'A sua aventura começa aqui.',
  'game.empty.hint': 'Diga ao Mestre o que você quer fazer.',
  'game.localeChanged': 'Idioma alterado para Português',
  'game.warming': 'O Mestre está despertando… {secs}s',
  'game.warmingPlaceholder': 'O Mestre está despertando…',
  'game.editingBanner': 'Editando a sua última ação',
  'game.editLast': 'Editar a sua última ação',
  'game.edit': 'Editar',
  'game.editPlaceholder': 'Corrija a sua ação e salve a edição…',
  'game.actionPlaceholder': 'O que você faz? (Enter para enviar, Shift+Enter para nova linha)',
  'game.editLabel': 'Editar a sua ação',
  'game.actionLabel': 'A sua ação',
  'game.cancel': 'Cancelar',
  'game.saveEdit': 'Salvar edição',
  'game.send': 'Enviar ação',
  'game.error.connect': 'Erro ao conectar com o Mestre. Tente novamente.',
} as const

export type MessageKey = keyof typeof ptBR
