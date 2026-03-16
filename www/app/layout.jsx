import './globals.css'

export const metadata = {
  title: 'Tend — Lightweight attention infrastructure for humans and agents',
  description: 'One command, one glance, then back to work. A CLI tool that gives developers a single pull-based view of all their AI agent projects.',
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
