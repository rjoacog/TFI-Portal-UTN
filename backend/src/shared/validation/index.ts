import { z } from 'zod';

// Los mensajes de validación de Zod los ve el usuario, así que se muestran en español.
z.config(z.locales.es());

export { z };
