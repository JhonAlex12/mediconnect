import { io } from 'socket.io-client';

// Uso:  node scripts/escuchar.js pantalla
//       node scripts/escuchar.js <token>
const argumento = process.argv[2];
const auth = argumento === 'pantalla' ? { tipo: 'pantalla' } : { token: argumento };

const socket = io('http://localhost:3000', { auth });

socket.on('connect', () => console.log('Conectado. Esperando eventos...'));
socket.on('connect_error', (error) => console.log('Error de conexión:', error.message));

// Muestra cualquier evento que llegue, con la hora
socket.onAny((evento, datos) => {
  console.log(new Date().toLocaleTimeString('es-CO'), evento, JSON.stringify(datos));
});