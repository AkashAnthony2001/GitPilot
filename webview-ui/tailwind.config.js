/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        vsc: {
          bg: 'var(--vscode-editor-background)',
          fg: 'var(--vscode-editor-foreground)',
          card: 'var(--vscode-sideBar-background, var(--vscode-editorWidget-background))',
          cardHover: 'var(--vscode-list-hoverBackground)',
          border: 'var(--vscode-panel-border, var(--vscode-widget-border, rgba(128,128,128,0.2)))',
          desc: 'var(--vscode-descriptionForeground)',
          btn: 'var(--vscode-button-background)',
          btnFg: 'var(--vscode-button-foreground)',
          btnHover: 'var(--vscode-button-hoverBackground)',
          btnSec: 'var(--vscode-button-secondaryBackground)',
          btnSecFg: 'var(--vscode-button-secondaryForeground)',
          btnSecHover: 'var(--vscode-button-secondaryHoverBackground)',
          badge: 'var(--vscode-badge-background)',
          badgeFg: 'var(--vscode-badge-foreground)',
          input: 'var(--vscode-input-background)',
          inputFg: 'var(--vscode-input-foreground)',
          inputBorder: 'var(--vscode-input-border, transparent)',
          accent: 'var(--vscode-focusBorder)',
          success: 'var(--vscode-testing-iconPassed, #4ade80)',
          error: 'var(--vscode-testing-iconFailed, #f87171)',
          warning: 'var(--vscode-problemsWarningIcon-foreground, #fbbf24)',
        },
      },
      fontFamily: {
        sans: ['var(--vscode-font-family)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['var(--vscode-editor-font-family)', 'monospace'],
      },
    },
  },
  plugins: [],
};
