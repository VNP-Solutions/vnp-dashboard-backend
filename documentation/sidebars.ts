import type {SidebarsConfig} from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started/setup',
        'getting-started/environment',
        'getting-started/commands'
      ]
    },
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/module-pattern',
        'architecture/auth',
        'architecture/permissions',
        'architecture/query-builder'
      ]
    },
    {
      type: 'category',
      label: 'Modules',
      items: [
        'modules/auth',
        'modules/portfolio',
        'modules/property',
        'modules/audit',
        'modules/user',
        'modules/user-role',
        'modules/global-report',
        'modules/pending-action',
        'modules/bank-details',
        'modules/api-key',
        'modules/file-upload'
      ]
    },
    {
      type: 'category',
      label: 'Deep Dives',
      items: [
        'deep-dives/ota-amounts',
        'deep-dives/amount-confirmed',
        'deep-dives/invitation-hierarchy',
        'deep-dives/bank-details'
      ]
    },
    {
      type: 'category',
      label: 'Ops',
      items: ['ops/seeding', 'ops/migrations', 'ops/backups']
    },
    {
      type: 'category',
      label: 'Contributing',
      items: ['contributing/code-style', 'contributing/troubleshooting']
    }
  ]
}

export default sidebars
