'use client'

import { useT } from '@/components/LocaleProvider'

// US-98: o nome da marca é traduzido ("Mestre da Crônica" / "Chronicle Master"),
// então deixou de poder ser literal no cabeçalho do SceneFrame.
//
// Existe como componente PRÓPRIO, e não como um `useT()` dentro do `dm.tsx`, porque
// aquele módulo tem de continuar renderizável no servidor: `app/page.tsx` monta o
// SceneFrame sem 'use client', e um hook ali tornaria a home inteira um componente
// de cliente. Um componente de cliente DENTRO de um de servidor é o caminho normal —
// é o mesmo que o SceneFrame já faz com o LocaleToggle.
export function BrandName({ className }: { className?: string }) {
  const t = useT()
  return <span className={className}>{t('common.appName')}</span>
}
