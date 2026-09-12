module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // zod v4 ships `export * as ...`; the RN preset does not transform it.
    '@babel/plugin-transform-export-namespace-from',
  ],
};