import './globals.css'

export const metadata = {
  title: 'Tend — Lightweight attention infrastructure for humans and agents',
  description: 'Who\'s stuck? Who needs you? A CLI that gives developers and agents a single pull-based board across all projects — local or remote. One command, one glance, then back to work.',
  metadataBase: new URL('https://tend.cx'),
  alternates: {
    types: {
      'text/plain': [
        { url: '/llms.txt', title: 'LLM-readable summary' },
        { url: '/llms-full.txt', title: 'LLM-readable full documentation' },
      ],
    },
  },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' font-family='monospace'>t</text></svg>",
  },
  openGraph: {
    title: 'Tend — Who\'s stuck? Who needs you?',
    description: 'Lightweight attention infrastructure for humans and AI agents. One CLI, one board, every agent — local or remote. No daemon, no database.',
    url: 'https://tend.cx',
    siteName: 'Tend',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'Tend — Who\'s stuck? Who needs you?',
    description: 'Lightweight attention infrastructure for humans and AI agents. One CLI, one board, every agent — local or remote.',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@1&family=Inter:wght@400;500&family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
