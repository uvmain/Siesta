import { defineConfig } from 'unocss'

export default defineConfig({
  shortcuts: {
    'focus-ring': 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'ui-control': 'focus-ring rounded-md border border-border bg-elevated px-3 py-2 text-sm text-primary transition-colors',
    'ui-icon-button': 'focus-ring grid size-8 place-items-center rounded-md text-secondary hover:bg-elevated hover:text-primary',
  },
  theme: {
    colors: {
      'canvas': 'var(--ui-canvas)',
      'sidebar': 'var(--ui-sidebar)',
      'panel': 'var(--ui-panel)',
      'elevated': 'var(--ui-elevated)',
      'border': 'var(--ui-border)',
      'primary': 'var(--ui-primary)',
      'secondary': 'var(--ui-secondary)',
      'accent': 'var(--ui-accent)',
      'success': 'var(--ui-success)',
      'warning': 'var(--ui-warning)',
      'danger': 'var(--ui-danger)',
      'info': 'var(--ui-info)',
      'method-get': 'var(--ui-method-get)',
      'method-post': 'var(--ui-method-post)',
      'method-put': 'var(--ui-method-put)',
      'method-patch': 'var(--ui-method-patch)',
      'method-delete': 'var(--ui-method-delete)',
      'method-head': 'var(--ui-method-head)',
      'method-options': 'var(--ui-method-options)',
    },
    fontFamily: {
      ui: 'Inter, ui-sans-serif, system-ui, sans-serif',
      code: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    },
  },
  preflights: [
    {
      getCSS: () => `
        :root, [data-theme="dark"] {
          color-scheme: dark;
          --ui-canvas: #111318;
          --ui-sidebar: #171a21;
          --ui-panel: #1c2029;
          --ui-elevated: #232834;
          --ui-border: #303643;
          --ui-primary: #e6eaf0;
          --ui-secondary: #929baa;
          --ui-accent: #8b7cff;
          --ui-success: #36b37e;
          --ui-warning: #e5a93d;
          --ui-danger: #e05d68;
          --ui-info: #55a6e8;
          --ui-method-get: #36b37e;
          --ui-method-post: #e5a93d;
          --ui-method-put: #55a6e8;
          --ui-method-patch: #8b7cff;
          --ui-method-delete: #e05d68;
          --ui-method-head: #929baa;
          --ui-method-options: #55a6e8;
        }

        [data-theme="light"] {
          color-scheme: light;
          --ui-canvas: #f7f8fb;
          --ui-sidebar: #eef0f5;
          --ui-panel: #ffffff;
          --ui-elevated: #f4f6fa;
          --ui-border: #d7dce5;
          --ui-primary: #18202d;
          --ui-secondary: #5f6b7b;
          --ui-accent: #6558d9;
          --ui-success: #198754;
          --ui-warning: #a56d00;
          --ui-danger: #c23e4b;
          --ui-info: #2374b7;
          --ui-method-get: #198754;
          --ui-method-post: #a56d00;
          --ui-method-put: #2374b7;
          --ui-method-patch: #6558d9;
          --ui-method-delete: #c23e4b;
          --ui-method-head: #5f6b7b;
          --ui-method-options: #2374b7;
        }

        html, body, #app {
          min-height: 100%;
          margin: 0;
        }
      `,
    },
  ],
})
