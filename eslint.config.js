// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      // eslint ignore globs here
    ],
  },
  {
    rules: {
      'curly': ['error', 'all'],
      'style/arrow-parens': ['error', 'always'],
      'style/brace-style': ['error', 'stroustrup'],
    },
  },
)
