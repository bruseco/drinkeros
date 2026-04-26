/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcomeEmail } from './welcome.tsx'
import { template as clubeRenewal30d } from './clube-renewal-30d.tsx'
import { template as clubeRenewal10d } from './clube-renewal-10d.tsx'
import { template as clubeRenewal5d } from './clube-renewal-5d.tsx'
import { template as clubeRenewal3d } from './clube-renewal-3d.tsx'
import { template as clubeRenewal1d } from './clube-renewal-1d.tsx'
import { template as clubeRenewal0d } from './clube-renewal-0d.tsx'
import { template as clubeRenewalPlus3d } from './clube-renewal-plus3d.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome': welcomeEmail,
  'clube-renewal-30d': clubeRenewal30d,
  'clube-renewal-10d': clubeRenewal10d,
  'clube-renewal-5d': clubeRenewal5d,
  'clube-renewal-3d': clubeRenewal3d,
  'clube-renewal-1d': clubeRenewal1d,
  'clube-renewal-0d': clubeRenewal0d,
  'clube-renewal-plus3d': clubeRenewalPlus3d,
}
