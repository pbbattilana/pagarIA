module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@copilotkit|@ag-ui|@langchain|@gorhom|uuid|web-streams-polyfill|text-encoding|react-native-qrcode-svg|react-native-svg|react-native-get-random-values)/)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
};