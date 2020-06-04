module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
  },
  env: {
    node: true,
    mocha: true,
  },
  globals: {
    artifacts: 'readonly',
    contract: 'readonly',
    web3: true,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'airbnb-base',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/eslint-recommended', // adjust eslint:recommend
    'plugin:@typescript-eslint/recommended',
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
  ],
  rules: {
    'no-await-in-loop': ['off'],
    'lines-between-class-members': ['off'],
    'prefer-destructuring': ['off'],
    'import/extensions': [
      'error',
      'ignorePackages',
      {
        js: 'never',
        ts: 'never',
      },
    ],
  },
}
