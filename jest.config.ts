import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // Medimos cobertura sobre la lógica de negocio, filtros, validación y utilidades;
  // los controllers, DTOs, módulos y bootstrap se verifican en la suite E2E (npm run test:e2e).
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.service.ts',
    '**/*.filter.ts',
    '**/*.utils.ts',
    'config/env.validation.ts',
  ],
  coverageDirectory: '../coverage',
  // Umbral mínimo justificado: 70% de líneas y 55% de ramas aseguran que cada regla
  // crítica (auth, aislamiento, vínculo con Ovenbird, Haversine, histéresis y fail-fast)
  // mantenga cobertura real sin forzar pruebas artificiales de getters o logs defensivos.
  coverageThreshold: {
    global: {
      lines: 70,
      branches: 55,
    },
  },
  testEnvironment: 'node',
};

export default config;
