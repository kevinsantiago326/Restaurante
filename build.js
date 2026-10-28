/**
 * build.js - Se ejecuta en el build de Cloudflare Pages.
 * Genera config.js (raiz del proyecto) a partir de variables de entorno,
 * para no subir credenciales al repositorio (config.js esta en .gitignore).
 *
 * Variables requeridas en Cloudflare (Production Y Preview):
 *   supabaseUrl  -> https://<proyecto>.supabase.co
 *   supabaseKey  -> anon key (JWT con role "anon") o sb_publishable_...
 *
 * Los nombres no distinguen mayusculas/minusculas y se aceptan alias
 * (SUPABASE_URL, SUPABASE_KEY, SUPABASE_ANON_KEY, etc.).
 *
 * Seguridad (fail-closed): la key termina dentro de un JS publico, asi que
 * NUNCA puede ser privada. Si es sb_secret_ / service_role, o un formato
 * desconocido, el build se aborta.
 */
const fs = require('fs');
const path = require('path');

const ALIAS_URL = ['supabaseurl', 'supabase_url', 'supabase_project_url', 'next_public_supabase_url', 'vite_supabase_url'];
const ALIAS_KEY = ['supabasekey', 'supabase_key', 'supabase_anon_key', 'supabase_publishable_key', 'supabase_public_key', 'next_public_supabase_anon_key', 'vite_supabase_anon_key'];

function pick(aliases) {
  for (const [name, value] of Object.entries(process.env)) {
    if (aliases.includes(name.toLowerCase()) && value && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

const supabaseUrl = pick(ALIAS_URL).replace(/\/$/, '');
const supabaseKey = pick(ALIAS_KEY);

// 1. Verificar que existan
const missing = [];
if (!supabaseUrl) missing.push('supabaseUrl');
if (!supabaseKey) missing.push('supabaseKey');

if (missing.length) {
  const seen = Object.keys(process.env).filter(k => /supabase/i.test(k));
  console.error('FALTAN variables de entorno: ' + missing.join(', '));
  console.error('Variables "supabase" detectadas en este build: ' + (seen.length ? seen.join(', ') : '(ninguna)'));
  console.error('Si no aparece ninguna, la variable no esta disponible en el build.');
  console.error('Crea las variables como tipo TEXT (no Secret) en la seccion Build > Variables and secrets,');
  console.error('en Production y en Preview.');
  process.exit(1);
}

// 2. Validar URL
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  console.warn('Aviso: supabaseUrl no parece una URL del tipo https://<proyecto>.supabase.co');
}

// 3. Validar que la key sea publica
const b64url = s => s.replace(/-/g, '+').replace(/_/g, '/');

function tipoDeKey(key) {
  if (/^sb_secret_/i.test(key) || /service_role/i.test(key)) {
    console.error('ERROR: supabaseKey es una clave PRIVADA (sb_secret_ / service_role). No puede ir al navegador. Abortando.');
    process.exit(1);
  }
  if (/^sb_publishable_/i.test(key)) return 'publishable';

  if (key.split('.').length === 3 && /^eyJ/.test(key)) {
    let role = '';
    try {
      const payload = JSON.parse(Buffer.from(b64url(key.split('.')[1]), 'base64').toString('utf8'));
      role = payload && payload.role ? String(payload.role) : '';
    } catch (e) { /* payload ilegible: se rechaza abajo */ }

    if (role === 'anon') return 'jwt:anon';
    console.error('ERROR: el JWT de supabaseKey tiene role="' + (role || 'desconocido') + '" (se espera "anon"). Abortando.');
    process.exit(1);
  }

  console.error('ERROR: supabaseKey tiene un formato desconocido (se espera sb_publishable_... o un JWT anon). Abortando.');
  process.exit(1);
}

const tipo = tipoDeKey(supabaseKey);

// 4. Generar config.js en la raiz (mismo formato que usabas antes)
const contenido =
  '/* Generado por build.js en Cloudflare Pages. No editar ni subir a Git. */\n' +
  "import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';\n\n" +
  'const supabaseUrl = ' + JSON.stringify(supabaseUrl) + ';\n' +
  'const supabaseKey = ' + JSON.stringify(supabaseKey) + ';\n\n' +
  'export const supabase = createClient(supabaseUrl, supabaseKey);\n';

const salida = path.join(__dirname, 'config.js');
fs.writeFileSync(salida, contenido, 'utf8');

console.log('Generado ' + salida + ' (URL presente; key: ' + tipo + ', ' + supabaseKey.length + ' caracteres)');