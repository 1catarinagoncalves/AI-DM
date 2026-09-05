import type { MessageKey } from './pt-BR'

// US-98: dicionário en-US. Ao contrário do pt-BR (que é recorte do JSX), este é
// texto NOVO.
//
// O tipo é o gate: `Record<MessageKey, string>` faz chave esquecida na tradução
// virar erro de compilação no `pnpm typecheck` que o CI já roda — em vez de chegar
// à produção como `undefined` no meio da tela.
export const enUS: Record<MessageKey, string> = {
  // ---- comum a todas as telas ----
  'common.appName': 'Chronicle Master',
  'common.skipLink': 'Skip to content',
  'common.signOut': 'Sign out',
  'common.retry': 'Try again',
  'common.theme.toLight': 'Switch to light mode',
  'common.theme.toDark': 'Switch to dark mode',
  'common.locale.group': 'Table language',

  'meta.title': 'Chronicle Master',
  'meta.description': 'Your AI-powered RPG narrator',

  // ---- login ----
  'login.subtitle': 'Sign in so your characters follow you on any device.',
  'login.google': 'Sign in with Google',

  // ---- home / hub ----
  'home.empty.title': 'Hello, Adventurer',
  'home.empty.none': "You don't have any characters yet.",
  'home.empty.hint': 'Create your first character to start playing.',
  'home.empty.create': 'Create my character',
  'home.loading': 'Loading your characters…',
  'home.error.load': "Couldn't load your characters.",
  'home.error.delete': "Couldn't delete the character. Try again.",
  'home.welcomeBack': 'Welcome back, Adventurer.',
  'home.level': 'Lv.{level}',
  'home.adventureLabel': 'Adventure:',
  'home.continue': 'Continue playing',
  'home.noAdventure': 'No adventure in progress',
  'home.newCharacter': 'Create a new character',
  'home.delete': 'Delete {name}',
  'home.confirmDelete': 'Delete {name}? This action cannot be undone.',
  'home.showAll': 'See all characters',

  // ---- wizard: trilha de etapas ----
  'setup.progress': 'Progress',
  'setup.stepOf': 'Step {n} of {total} — {label}',
  'setup.step.system': 'System',
  'setup.step.class': 'Class',
  'setup.step.race': 'Species',
  'setup.step.attributes': 'Attributes',
  'setup.step.skills': 'Skills',
  'setup.step.background': 'Background',
  'setup.step.review': 'Review',
  'setup.step.world': 'World',
  'setup.back': 'Back',
  // US-107: saída da criação. "Voltar" (rodapé) anda uma etapa; este sai da tela —
  // por isso o rótulo nomeia o DESTINO, e não repete o verbo sozinho.
  'setup.exit': 'Back to characters',
  'setup.next': 'Next',
  'setup.confirming': 'Creating...',
  // US-157: seventh step, after `review` — adventure setting/tone/area type.
  'setup.world.titulo': 'The world of the adventure',
  'setup.world.subtitulo': 'Choose setting, tone and area type — or leave each one on Random.',
  // US-216: bifurcation at the start of the `world` step — "ready" (class hook, zero
  // configuration) or "custom" (the usual screen, below).
  'setup.world.mode.subtitulo': 'How do you want to begin?',
  'setup.world.mode.ready.title': 'Ready adventure',
  'setup.world.mode.ready.hint': 'Start right away with the ready-made hook for your class.',
  'setup.world.mode.custom.title': 'Create my own story',
  'setup.world.mode.custom.hint': 'Choose setting, tone, area and challenge from scratch.',
  'setup.world.setting': 'Setting',
  'setup.world.tone': 'Tone',
  'setup.world.areaType': 'Area Type',
  'setup.world.random': 'Random',
  'setup.world.challenge': 'Challenge',
  'setup.world.challenge.adventure.label': 'Adventure mode',
  'setup.world.challenge.adventure.hint': 'may have no combat',
  'setup.world.challenge.challenge.label': 'Challenge mode',
  'setup.world.challenge.challenge.hint': 'combat guaranteed',
  'setup.world.start': 'Create adventure',
  'setup.world.starting': 'Creating adventure...',
  'setup.world.loading.1': 'Populating the world with its first inhabitants...',
  'setup.world.loading.2': 'Sowing secrets across the map...',
  'setup.world.loading.3': 'Giving a face to whoever stands against you...',
  'setup.world.loading.4': 'Choosing the first dangers on your path...',
  'setup.world.loading.5': 'Tying the threads that will pull the story forward...',
  'setup.world.loading.6': 'Sharpening the details before the curtain opens...',

  // ---- wizard: sistema ----
  'setup.system.titulo': 'Choose the System',
  'setup.system.subtitulo': 'It sets the rules that will guide your journey.',
  'setup.system.loading': 'Loading systems...',
  'setup.system.error': "Couldn't load the systems. Reload the page.",
  'setup.system.hint.FREE': 'Free narration, no official system',
  'setup.system.hint.SRD': 'Official rules from a well-known system',
  'setup.system.hint.UPLOAD': 'Custom system uploaded by a user',

  // ---- wizard: class and race (US-205: two steps, `class` then `race`) ----
  'setup.class.eyebrow': 'Choose a class',
  'setup.class.titulo': 'Class',
  'setup.race.eyebrow': 'Choose a species',
  'setup.race.heading': 'Where does your blood come from?',
  'setup.race.subtitulo': 'Your species brings ability bonuses, senses, and unique traits — some have variants to refine further.',
  'setup.raceClass.system': 'System: {name}',
  'setup.raceClass.name': 'Character name',
  'setup.raceClass.namePlaceholder': 'E.g.: Lyra Silvermoon',
  'setup.raceClass.gender': 'Gender',
  'setup.raceClass.race': 'Race',
  'setup.raceClass.class': 'Class',
  'setup.raceClass.select': 'Select…',
  'setup.subclass.legend': 'Subclass',
  'setup.class.detail.kit': 'Starting equipment',
  'setup.class.detail.subclass': 'Subclass',
  'setup.race.detail.features': 'Racial traits',
  'setup.race.variant.legend': 'Choose a variant',
  // Dwarf "Tool Proficiency" trait — legend for the artisan's tool choice grid, hill-dwarf only.
  'setup.race.dwarfTool.legend': "Choose your artisan's tool",
  // High Elf "Extra Language" trait — legend for the extra language <select>, high-elf only.
  'setup.race.extraLanguage.legend': 'Choose your extra language',

  // US-211: dragonborn draconic ancestry — see the pt-BR.ts comment for why the label lives
  // here instead of the SRD overlay (DRACONIC_ANCESTRY_TABLE has no embedded label).
  'setup.race.draconicAncestry.resistance': 'Resistance to {damageType}',
  'setup.race.draconicAncestry.damageType.acid': 'Acid',
  'setup.race.draconicAncestry.damageType.cold': 'Cold',
  'setup.race.draconicAncestry.damageType.fire': 'Fire',
  'setup.race.draconicAncestry.damageType.lightning': 'Lightning',
  'setup.race.draconicAncestry.damageType.poison': 'Poison',
  'setup.race.draconicAncestry.black.name': 'Black Dragon',
  'setup.race.draconicAncestry.black.blurb': 'Breath in a line of corrosive acid.',
  'setup.race.draconicAncestry.blue.name': 'Blue Dragon',
  'setup.race.draconicAncestry.blue.blurb': 'Breath in a line of crackling lightning.',
  'setup.race.draconicAncestry.brass.name': 'Brass Dragon',
  'setup.race.draconicAncestry.brass.blurb': 'Breath in a line of scorching fire.',
  'setup.race.draconicAncestry.bronze.name': 'Bronze Dragon',
  'setup.race.draconicAncestry.bronze.blurb': 'Breath in a line of crackling lightning.',
  'setup.race.draconicAncestry.copper.name': 'Copper Dragon',
  'setup.race.draconicAncestry.copper.blurb': 'Breath in a line of corrosive acid.',
  'setup.race.draconicAncestry.gold.name': 'Gold Dragon',
  'setup.race.draconicAncestry.gold.blurb': 'Breath in a cone of searing fire.',
  'setup.race.draconicAncestry.green.name': 'Green Dragon',
  'setup.race.draconicAncestry.green.blurb': 'Breath in a cone of choking poison.',
  'setup.race.draconicAncestry.red.name': 'Red Dragon',
  'setup.race.draconicAncestry.red.blurb': 'Breath in a cone of searing fire.',
  'setup.race.draconicAncestry.silver.name': 'Silver Dragon',
  'setup.race.draconicAncestry.silver.blurb': 'Breath in a cone of freezing cold.',
  'setup.race.draconicAncestry.white.name': 'White Dragon',
  'setup.race.draconicAncestry.white.blurb': 'Breath in a cone of freezing cold.',

  // Só o RÓTULO é traduzido — o `value` enviado à API continua sendo a chave PT
  // (ver o comentário gêmeo no pt-BR.ts e em SetupWizard).
  // US-105: raça e classe não estão mais aqui; vêm do catálogo do sistema no locale ativo.
  'setup.gender.Feminino': 'Female',
  'setup.gender.Masculino': 'Male',
  'setup.gender.Não-binário': 'Non-binary',

  // ---- wizard: atributos ----
  'setup.attributes.titulo': 'Attributes',
  'setup.attributes.remaining': 'Points remaining:',
  'setup.attributes.decrease': 'Decrease {label}',
  'setup.attributes.increase': 'Increase {label}',
  // US-123: background ability bonus (grant.kind === 'ability').
  'setup.attributes.abilityBanner': '{origin} grants +1 fixed to {attr} and a +1 bonus — choose another attribute below.',
  // US-212: `{bonus}` is the SAME phrase from the race card (race-bonus.mjs), e.g. "+2 Dexterity"
  // or "+2 Charisma, +1 to 2 other abilities of your choice" — no own text to avoid duplicating it.
  'setup.attributes.raceBanner': '{race} grants {bonus}.',
  // US-212: same solid/ghost text (the ghost used to say "+1 bonus") — unified with the race
  // badge pattern below, the line's own amount/state already tells it apart visually.
  'setup.attributes.abilityBadgeFixed': '+1 origin',
  // US-212: race ability-score bonus badge — same solid/ghost text (the race's own amount
  // already tells the line apart, no need for a separate "bonus" label).
  'setup.attributes.raceBadge': '+{amount} race',

  // ---- wizard: perícias ----
  'setup.skills.titulo': 'Skills',
  // US-131: background skills section, at the TOP of this step (the origin already gave the
  // heads-up in the `background` step; this is where the actual choice happens).
  'setup.skills.originGrant': 'Skills from {origin}',
  'setup.skills.instructions': 'Choose {n} proficient skills (+{bonus} each).',
  'setup.skills.selected': 'Selected:',

  // ---- wizard: background ----
  'setup.background.titulo': 'Background',
  'setup.background.subtitulo': 'Who is {name}? The Dungeon Master uses this to give weight to your choices. All optional — one item per line in ideals, bonds and flaws.',
  'setup.background.defaultName': 'this character',
  'setup.background.story': 'Story',
  'setup.background.storyPlaceholder': 'E.g.: minor noble who lost their family to a demonic cult…',
  'setup.background.ideals': 'Ideals — one per line',
  'setup.background.idealsPlaceholder': 'E.g.: Justice above all',
  'setup.background.bonds': 'Bonds — one per line',
  'setup.background.bondsPlaceholder': 'E.g.: Swore vengeance on the cult that killed their family',
  'setup.background.flaws': 'Flaws — one per line',
  'setup.background.flawsPlaceholder': "E.g.: Rigid code of honour: never lies, never abandons the innocent",
  'setup.background.deity': 'Deity/Patron — name, and what they stand for',
  'setup.background.deityPlaceholder': 'E.g.: Auril, goddess of winter',

  // ---- wizard: origin (US-122) ----
  'setup.origin.titulo': 'Origin',
  // US-123: ability bonus notice, shown in the `background` step (the actual choice happens
  // in `attributes` — this is just the heads-up for what comes next).
  'setup.origin.abilityGrant': '+1 fixed to {attr}, +1 of your choice to another attribute.',
  'setup.origin.toolGrant': 'Proficiencies from {origin}',
  // US-132 (design critique 2026-08-14): <optgroup> labels for the tool select — only the 4
  // categories that currently show up inside a `chooseFrom` (see TOOL_CATEGORY_ORDER).
  'setup.tools.category.artisan': "Artisan's tools",
  'setup.tools.category.musical-instrument': 'Musical instruments',
  'setup.tools.category.gaming-set': 'Gaming sets',
  'setup.tools.category.vehicle': 'Vehicles',

  // ---- wizard: connection & memento (US-124) — title/subtitle are FIXED, not parsed from
  // the dataset's own heading/preamble (translation-fragile, see US-124 Questão 1/2).
  'setup.origin.connection': 'Connection',
  'setup.origin.memento': 'Memento',
  'setup.origin.pickHint': 'Choose from the list, or roll.',
  'setup.origin.random': 'Roll',

  // ---- wizard: revisão ----
  'setup.review.titulo': 'Review',
  'setup.review.subtitulo': 'Check your character sheet before setting out.',
  'setup.review.name': 'Name',
  'setup.review.gender': 'Gender',
  'setup.review.race': 'Race',
  'setup.review.class': 'Class',
  'setup.review.subclass': 'Subclass',
  'setup.review.draconicAncestry': 'Draconic ancestry',
  'setup.review.level': 'Level',
  'setup.review.hp': 'Starting HP',
  'setup.review.attributes': 'Attributes',
  'setup.review.skills': 'Skills',
  'setup.review.tools': 'Proficiencies',
  'setup.review.languages': 'Languages',
  'setup.review.kit': 'Starting kit',
  'setup.review.background': 'Background',
  'setup.review.origin': 'Origin',
  'setup.review.connection': 'Connection',
  'setup.review.memento': 'Memento',

  // ---- wizard: erros ----
  'setup.error.create': 'Something went wrong creating the character. Try again.',
  'setup.error.start': 'Something went wrong starting the adventure. Try again.',

  // ---- gancho de aventura inicial ----

  // ---- mesa de jogo ----
  'game.notFound': 'Character not found.',
  'game.restart': 'Start over',
  // US-107: no mobile é o nome acessível de um controlo só-ícone — tem de dizer para
  // onde vai sozinho, sem depender da seta.
  'game.exit': 'Back to characters',
  'game.sheetToggle': 'Sheet — {name}',
  'game.sheetTabs': 'Character sheet',
  'game.tab.ficha': 'Sheet',
  'game.tab.features': 'Features',
  'game.tab.background': 'Background',
  'game.hp': 'HP',
  'game.conditions': 'Conditions',
  'game.attributes': 'Attributes',
  'game.attr.strength': 'STR',
  'game.attr.dexterity': 'DEX',
  'game.attr.constitution': 'CON',
  'game.attr.intelligence': 'INT',
  'game.attr.wisdom': 'WIS',
  'game.attr.charisma': 'CHA',
  'game.skills': 'Skills',
  'game.proficient': 'Proficient',
  'game.tools': 'Proficiencies',
  'game.languages': 'Languages',
  'game.inventory': 'Inventory ({n})',
  'game.inventoryEmpty': 'No items',
  'game.background.empty': "This character doesn't have a story yet.",
  'game.background.origin': 'Origin',
  'game.background.connection': 'Connection',
  'game.background.memento': 'Memento',
  'game.background.adventures': 'Adventures & Advancement',
  'game.background.story': 'Story',
  'game.background.deity': 'Deity/Patron',
  'game.background.ideals': 'Ideals',
  'game.background.bonds': 'Bonds',
  'game.background.flaws': 'Flaws',
  'game.features.empty': "This class doesn't have any features or spells recorded yet.",
  'game.features.title': 'Features',
  'game.features.tag.class': 'Class',
  'game.features.tag.background': 'Origin',
  'game.spells.title': 'Spells',
  'game.log': "Dungeon Master's narration",
  'game.empty.title': 'Your adventure begins here.',
  'game.empty.hint': 'Tell the Dungeon Master what you want to do.',
  'game.localeChanged': 'Language changed to English',
  'game.warming': 'The Dungeon Master is waking up… {secs}s',
  'game.warmingPlaceholder': 'The Dungeon Master is waking up…',
  'game.editingBanner': 'Editing your last action',
  'game.editLast': 'Edit your last action',
  'game.edit': 'Edit',
  'game.editPlaceholder': 'Fix your action and save the edit…',
  'game.actionPlaceholder': 'What do you do? (Enter to send, Shift+Enter for a new line)',
  'game.editLabel': 'Edit your action',
  'game.actionLabel': 'Your action',
  'game.cancel': 'Cancel',
  'game.saveEdit': 'Save edit',
  'game.send': 'Send action',
  'game.error.connect': "Couldn't reach the Dungeon Master. Try again.",
}
