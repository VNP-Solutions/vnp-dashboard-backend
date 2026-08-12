import {themes as prismThemes} from 'prism-react-renderer'
import type {Config} from '@docusaurus/types'
import type * as Preset from '@docusaurus/preset-classic'

const config: Config = {
  title: 'VNP Backend Docs',
  tagline: 'Developer documentation for the VNP Dashboard Backend',
  favicon: 'img/logo.svg',

  future: {
    v4: true
  },

  url: 'https://dashboard-backend.vnpmanage.online',
  baseUrl: '/docs/',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts'
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css'
        }
      } satisfies Preset.Options
    ]
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true
    },
    navbar: {
      title: 'VNP Backend Docs',
      logo: {
        alt: 'VNP Backend',
        src: 'img/logo.svg'
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation'
        },
        {
          href: 'pathname:///api/docs',
          label: 'Swagger API',
          position: 'right'
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Getting Started',
          items: [
            {label: 'Introduction', to: '/'},
            {label: 'Local Setup', to: '/getting-started/setup'},
            {label: 'Commands', to: '/getting-started/commands'}
          ]
        },
        {
          title: 'Architecture',
          items: [
            {label: 'Overview', to: '/architecture/overview'},
            {label: 'Permissions', to: '/architecture/permissions'},
            {label: 'Authentication', to: '/architecture/auth'}
          ]
        },
        {
          title: 'API',
          items: [
            {label: 'Swagger UI', href: 'pathname:///api/docs'},
            {label: 'OpenAPI JSON', href: 'pathname:///api/docs.json'}
          ]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} VNP Dashboard Backend. Built with Docusaurus.`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript']
    }
  } satisfies Preset.ThemeConfig
}

export default config
