export interface SuperFund {
  fund_name: string
  abn: string
  usi: string
  is_active: boolean
}

export const AUSTRALIAN_SUPER_FUNDS: SuperFund[] = [
  { fund_name: 'AustralianSuper', abn: '94 006 457 987', usi: 'AUS0001AU', is_active: true },
  { fund_name: 'Hostplus', abn: '68 901 251 351', usi: 'HOS0001AU', is_active: true },
  { fund_name: 'REST Super', abn: '60 905 115 063', usi: 'RSE0001AU', is_active: true },
  { fund_name: 'HESTA', abn: '64 971 749 321', usi: 'HES0001AU', is_active: true },
  { fund_name: 'Aware Super', abn: '53 226 460 365', usi: 'STA0100AU', is_active: true },
  { fund_name: 'UniSuper', abn: '91 385 943 850', usi: 'UNI0001AU', is_active: true },
  { fund_name: 'Cbus', abn: '75 635 883 559', usi: 'CBU0100AU', is_active: true },
  { fund_name: 'Australian Retirement Trust', abn: '60 905 115 063', usi: 'QSU0100AU', is_active: true },
  { fund_name: 'BUSSQ', abn: '85 571 332 201', usi: 'BUS0100AU', is_active: true },
  { fund_name: 'CareSuper', abn: '98 172 275 725', usi: 'CSF0100AU', is_active: true },
  { fund_name: 'First Super', abn: '42 053 498 472', usi: 'FSF0100AU', is_active: true },
  { fund_name: 'LUCRF Super', abn: '18 005 502 090', usi: 'LRF0001AU', is_active: true },
  { fund_name: 'Media Super', abn: '91 579 702 519', usi: 'PSS0001AU', is_active: true },
  { fund_name: 'NGS Super', abn: '73 549 180 515', usi: 'NGS0001AU', is_active: true },
  { fund_name: 'Telstra Super', abn: '85 502 108 833', usi: 'TSF0100AU', is_active: true },
]
