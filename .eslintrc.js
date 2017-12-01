module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
    sourceType: 'module',
    ecmaFeatures: {
      'jsx': true
    },
  },
  plugins: [
    'react'
  ],
  extends: 'react-app',
  rules: {
    // allow paren-less arrow functions
    'arrow-parens': 0,
    // allow async-await
    'generator-star-spacing': 1,
    // allow debugger during development
    'no-debugger': 1,
    'comma-dangle': 0,
    'camelcase': 0,
    'no-alert': 1,
    'space-before-function-paren': 1,
    'react/jsx-uses-react': 'error',
    'react/jsx-uses-vars': 'error',
  }
}
