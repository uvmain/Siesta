import antfu from '@antfu/eslint-config'

export default antfu(
  {
    vue: true,
    unocss: true,
    typescript: {
      projectService: true,
    },
    ignores: ['**/dist/**'],
    rules: {
      'no-console': 'off',
      'brace-style': ['error', 'stroustrup'],
      'vue/html-self-closing': 'off',
    },
  },
  {
    // frontend
    files: ['frontend/**/*.{vue,ts,js,json}'],
    ignores: ['public', '**/public/**'],
  },
  {
    // backend
    files: ['backend/**/*.{ts,js,json}'],
  },
)
