module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'middleware/**/*.js',
    'utils/**/*.js',
    '!utils/backupService.js',
    '!utils/storageService.js',
  ],
  coverageDirectory: 'coverage',
};
