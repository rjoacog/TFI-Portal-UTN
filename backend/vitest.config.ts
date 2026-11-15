import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // No toma las pruebas compiladas que deja `npm run build` en `dist/`.
    exclude: ['dist/**', 'node_modules/**'],
    // Valida `DATABASE_URL_TEST` y aplica las migraciones al esquema `test` antes de correr.
    globalSetup: ['./src/test/global-setup.ts'],
    // En cada archivo de pruebas apunta el cliente de Prisma al esquema `test`.
    setupFiles: ['./src/test/setup.ts'],
    // Las pruebas comparten el esquema `test`: no pueden correr en paralelo.
    fileParallelism: false,
  },
});
