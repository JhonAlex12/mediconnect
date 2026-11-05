import { Router } from 'express';
import { catalogo, recientes, emitir } from '../controllers/simulador.controller.js';

// Rutas del Simulador de IPS (el "doctor" de la demostración).
// La IPS real usa POST /api/ips/formulas con su clave; el navegador no puede
// guardar esa clave, así que el simulador tiene sus propias rutas y solo
// existen con MODO_DEMO=true.
const router = Router();

router.use((req, res, next) => {
  if (process.env.MODO_DEMO !== 'true') {
    return res.status(404).json({ ok: false, mensaje: 'Función no disponible' });
  }
  next();
});

router.get('/medicamentos', catalogo);
router.get('/formulas', recientes);
router.post('/formulas', emitir);

export default router;
