'use client'

import React from 'react'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getPartyById } from '@/lib/server/party'

interface PartyLogoProps {
  party_id: number
  size?: number
}

export default function PartyLogo({
  party_id,
  size = 40,
}: PartyLogoProps): React.ReactElement {
  const [partyData, setPartyData] = React.useState<Awaited<
    ReturnType<typeof getPartyById>
  > | null>(null)

  React.useEffect(() => {
    getPartyById({ data: { partyId: party_id } }).then(setPartyData)
  }, [party_id])

  if (!partyData) {
    return (
      <div
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          backgroundColor: '#e5e7eb',
        }}
      />
    )
  }

  const { color, logo, name } = partyData

  const toPascal = (s: string): string =>
    s
      .split(/[^a-zA-Z0-9]+/)
      .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : ''))
      .join('')

  let IconComponent: LucideIcon | null = null
  if (logo && typeof logo === 'string') {
    const iconsMap = LucideIcons as unknown as Record<string, LucideIcon>
    const direct = iconsMap[logo]
    if (direct) {
      IconComponent = direct
    } else {
      const pascal = toPascal(logo)
      IconComponent = iconsMap[pascal] || null
    }
  }

  const circleStyle: React.CSSProperties = {
    backgroundColor: color ?? '#888888',
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    flexShrink: 0,
  }

  const joinWords = new Set<string>([
    'and',
    'the',
    'of',
    'for',
    'in',
    'on',
    'at',
    'to',
    'a',
    'an',
  ])

  const initials: string = name
    ? name
        .split(/\s+/)
        .map((word) => word.replace(/[^a-zA-Z]/g, ''))
        .filter((word) => word.length > 0)
        .filter((word) => !joinWords.has(word.toLowerCase()))
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'P'

  return (
    <div
      style={circleStyle}
      aria-label={name || 'Party logo'}
      title={name || 'Party'}
    >
      {IconComponent ? (
        <IconComponent
          size={Math.floor(size * 0.6)}
          aria-hidden="true"
          focusable={false}
        />
      ) : (
        <span style={{ fontSize: Math.floor(size * 0.45), fontWeight: 700 }}>
          {initials}
        </span>
      )}
    </div>
  )
}
