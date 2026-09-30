import { assertTestDatabase, databaseName } from './global-setup.js';

describe('e2e test-database guard', () => {
  it('reads the database name from a connection string', () => {
    expect(databaseName('postgresql://me@localhost:5432/fuzzball_test')).toBe('fuzzball_test');
    expect(databaseName('postgresql://me:p%40ss@db.example.com/fuzzball?schema=public')).toBe('fuzzball');
    expect(databaseName('not a url')).toBeUndefined();
  });

  it('accepts a name ending in _test', () => {
    expect(() => assertTestDatabase('postgresql://me@localhost:5432/fuzzball_test')).not.toThrow();
  });

  it.each([
    ['dev database', 'postgresql://me@localhost:5432/fuzzball'],
    ['production-looking database', 'postgresql://me@db.example.com:5432/fuzzball_prod'],
    ['_test only in the middle', 'postgresql://me@localhost:5432/fuzzball_test_backup'],
    ['no database in the URL', 'postgresql://me@localhost:5432'],
    ['unparseable value', 'garbage'],
    ['unset', undefined],
  ])('refuses %s', (_label, url) => {
    expect(() => assertTestDatabase(url)).toThrow(/not a test database/);
  });
});
