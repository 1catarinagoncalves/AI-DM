import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'

const { listSystems, setLocale } = vi.hoisted(() => ({ listSystems: vi.fn(), setLocale: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { listSystems, setLocale } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { LocaleProvider, LOCALE_STORAGE_KEY } from './LocaleProvider'
import { LocaleToggle } from './LocaleToggle'
import { SetupWizard } from './setup/SetupWizard'
import { ptBR } from '@/messages/pt-BR'
import { enUS } from '@/messages/en-US'
import { localeFromCookie } from '@/lib/locale-cookie'

const config = {
  attributes: [{ key: 'strength', label: 'Força', min: 8, max: 15, default: 8 }],
  startingKits: { default: [] },
  pointBuy: { budget: 2 },
  // US-105: o catálogo de raça/classe vem do config do sistema, já no locale do dono (a API
  // resolve isso na US-99). Aqui ele é fixo em EN de propósito: é o que a API devolveria a um
  // jogador em inglês, e o teste abaixo separa o que é dicionário da UI do que é dado.
  races: [{ key: 'elf', label: 'Elf' }, { key: 'dwarf', label: 'Dwarf' }],
  classes: [{ key: 'wizard', label: 'Wizard' }, { key: 'fighter', label: 'Fighter' }],
}

beforeEach(() => {
  listSystems.mockResolvedValue([{ id: 'sys-1', name: 'D&D 5e SRD', sourceType: 'SRD', config }])
  setLocale.mockResolvedValue({ id: 'u1', locale: 'en-US' })
  localStorage.clear()
})
afterEach(() => cleanup())

// Visitante (sessão nula): a preferência vive no localStorage, como na US-97.
function renderWithLocale(children: React.ReactNode) {
  return render(
    <SessionProvider session={null}>
      <LocaleProvider>{children}</LocaleProvider>
    </SessionProvider>,
  )
}

describe('i18n da interface — dicionário ligado ao locale ativo (US-98)', () => {
  it('renderiza o wizard em pt-BR quando o locale ativo é pt-BR', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR')
    renderWithLocale(<SetupWizard />)

    expect(await screen.findByText('Escolha o Sistema')).toBeTruthy()
    expect(screen.getByText('Define as regras que guiarão a sua jornada.')).toBeTruthy()
  })

  it('renderiza o MESMO wizard em inglês quando o locale ativo é en-US', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en-US')
    renderWithLocale(<SetupWizard />)

    expect(await screen.findByText('Choose the System')).toBeTruthy()
    // Falha se o dicionário estiver ligado ao default em vez do locale ativo.
    expect(screen.queryByText('Escolha o Sistema')).toBeNull()
  })

  it('o rótulo do campo acompanha o idioma dentro de uma etapa', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en-US')
    renderWithLocale(<SetupWizard />)

    fireEvent.click(await screen.findByText('D&D 5e SRD'))
    expect(screen.getByLabelText('Character name')).toBeTruthy()
    expect(screen.getByLabelText('Class')).toBeTruthy()
  })

  it('trocar de idioma re-renderiza sem perder a etapa nem o texto já digitado', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'pt-BR')
    // O wizard já não traz seletor (o idioma vem do hub de personagens), então o
    // teste monta um ao lado para provocar a troca — é o LocaleProvider partilhado
    // que a propaga, que é o que este caso verifica.
    renderWithLocale(<><LocaleToggle /><SetupWizard /></>)

    fireEvent.click(await screen.findByText('D&D 5e SRD'))
    fireEvent.change(screen.getByLabelText('Nome do personagem'), { target: { value: 'Lyra' } })

    fireEvent.click(screen.getByRole('button', { name: 'English' }))

    // Mesma etapa (não voltou ao início) e o campo manteve o que estava digitado.
    const name = screen.getByLabelText('Character name') as HTMLInputElement
    expect(name.value).toBe('Lyra')
  })

  // US-105: o value de classe é a CHAVE do catálogo, e o texto é o label que o config trouxe —
  // não uma chave do dicionário da UI. Falha se alguém voltar a mandar o rótulo para a API.
  it('o VALUE de classe é a chave do catálogo, e o texto vem do config', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en-US')
    renderWithLocale(<SetupWizard />)

    fireEvent.click(await screen.findByText('D&D 5e SRD'))
    const options = screen.getByLabelText('Class').querySelectorAll('option')
    const wizard = [...options].find(o => o.textContent === 'Wizard')
    expect(wizard?.getAttribute('value')).toBe('wizard')
  })
})

describe('dicionários — paridade entre os dois idiomas (US-98)', () => {
  // O TIPO já garante que nenhuma chave falta no en-US (Record<MessageKey, string>).
  // O que ele NÃO vê é placeholder esquecido na tradução: 'Delete {name}?' traduzido
  // sem o `{name}` compila e some com o nome na tela.
  it('cada chave usa os mesmos placeholders nos dois idiomas', () => {
    const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort().join(',')
    const divergentes = Object.keys(ptBR).filter(
      (key) => placeholders(ptBR[key as keyof typeof ptBR]) !== placeholders(enUS[key as keyof typeof ptBR]),
    )
    expect(divergentes).toEqual([])
  })

  // US-102: o gate de literal não varre src/messages/ — é onde o texto DEVE estar.
  // O que sobra sem dono ali é traduzir esquecido: copiar a linha do pt-BR para o
  // en-US e não traduzir compila, passa no tipo e sai português na tela inglesa.
  // Medido em 04/08/2026: 143 chaves em cada, 9 valores idênticos, todos jargão.
  const IDENTICO_OK = new Set(['Background', 'Features', 'HP', 'CON', 'INT'])
  it('valor idêntico nos dois idiomas é jargão declarado, não tradução esquecida', () => {
    const naoTraduzidos = Object.keys(ptBR).filter((key) => {
      const k = key as keyof typeof ptBR
      return ptBR[k] === enUS[k] && !IDENTICO_OK.has(ptBR[k])
    })
    expect(naoTraduzidos).toEqual([])
  })
})

describe('locale do servidor a partir do cookie (US-98)', () => {
  it('valor válido do cookie vira locale', () => {
    expect(localeFromCookie('en-US')).toBe('en-US')
  })

  it('cookie ausente ou lixo cai no default do produto', () => {
    expect(localeFromCookie(undefined)).toBe('pt-BR')
    expect(localeFromCookie('klingon')).toBe('pt-BR')
  })
})
