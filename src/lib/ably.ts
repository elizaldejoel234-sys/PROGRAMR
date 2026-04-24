import * as Ably from 'ably';

// Para prototipado rápido, usamos la key que nos ha pasado el usuario por defecto o del env.
// NOTA: Para producción es mejor usar authUrl (token auth).
const ABLY_KEY = (import.meta as any).env?.VITE_ABLY_KEY || "7R_UZg.SRK9eg:LNALBWU0dnwHX7q4UJJjfih7V_qdrMXQjqMKF7Gy1lo";

export const ably = new Ably.Realtime({ 
  key: ABLY_KEY,
  idempotentRestPublishing: true,
  echoMessages: false
});

export const chatChannel = ably.channels.get('aura-chat-stream');
