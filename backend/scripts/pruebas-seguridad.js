// backend/scripts/pruebas-seguridad.js
//
// Pruebas de los módulos de seguridad. No necesitan base de datos ni servidor:
//     npm test        (o:  node scripts/pruebas-seguridad.js)
//
// Incluye una revisión automática de que ninguna consulta SQL arma texto con datos del usuario.

process.env.NODE_ENV = 'production';
process.env.FORCE_HTTPS = 'true';
process.env.FRONTEND_URL = 'https://app.ejemplo.gob.mx, http://localhost:5173';
process.env.BLOQUEAR_USER_AGENTS = 'true';
process.env.JWT_SECRET = 'x'.repeat(48);

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let total = 0;
const fallas = [];
async function prueba(nombre, fn) {
  total += 1;
  try {
    await fn();
    console.log(`  ok   ${nombre}`);
  } catch (e) {
    fallas.push(nombre);
    console.log(`  FALLA ${nombre}\n        ${e.message}`);
  }
}

// Respuesta falsa de Express
function respuesta() {
  const r = {
    codigo: 200,
    cabeceras: {},
    cuerpo: undefined,
    redirigido: null,
    status(c) { r.codigo = c; return r; },
    json(b) { r.cuerpo = b; return r; },
    setHeader(k, v) { r.cabeceras[k.toLowerCase()] = v; },
    append(k, v) { r.cabeceras[k.toLowerCase()] = v; },
    redirect(c, u) { r.codigo = c; r.redirigido = u; return r; },
    headersSent: false,
  };
  return r;
}
const siguiente = () => { const f = () => { f.llamado = true; }; f.llamado = false; return f; };

(async () => {
  // ------------------------------------------------------------------ cookies
  console.log('Cookies');
  const { leerCookie, serializarCookie } = require('../utils/cookies');
  await prueba('lee una cookie entre varias', () => {
    assert.strictEqual(leerCookie({ headers: { cookie: 'a=1; __Host-sesion=abc.def.ghi; b=2' } }, '__Host-sesion'), 'abc.def.ghi');
  });
  await prueba('devuelve null si no existe o está mal formada', () => {
    assert.strictEqual(leerCookie({ headers: {} }, 'x'), null);
    assert.strictEqual(leerCookie({ headers: { cookie: 'x=%E0%A4%A' } }, 'x'), null);
  });
  await prueba('la cookie de sesión sale HttpOnly + Secure + SameSite', () => {
    const c = serializarCookie('__Host-sesion', 'tok', { maxAgeSeg: 100, httpOnly: true, secure: true, sameSite: 'Lax' });
    for (const parte of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=100']) assert.ok(c.includes(parte), parte);
    assert.ok(!/Domain=/i.test(c));
  });
  await prueba('al cerrar sesión la cookie expira', () => {
    const c = serializarCookie('s', '', { maxAgeSeg: 0, httpOnly: true });
    assert.ok(c.includes('Max-Age=0') && c.includes('1970'));
  });

  // ------------------------------------------------------------------ validación
  console.log('Validación de campos');
  const v = require('../utils/validar');
  await prueba('entero acepta números y cadenas numéricas', () => {
    assert.strictEqual(v.entero('15'), 15);
    assert.strictEqual(v.entero(7), 7);
    assert.strictEqual(v.entero(''), null);
    assert.strictEqual(v.entero(undefined), null);
  });
  await prueba('entero rechaza inyecciones, objetos y negativos', () => {
    for (const malo of ["1; DROP TABLE usuarios", "1 OR 1=1", { $gt: 0 }, [1, 2], -3, 0, '1e5', '9'.repeat(20)]) {
      assert.throws(() => v.entero(malo), v.ErrorValidacion, JSON.stringify(malo));
    }
  });
  await prueba('texto rechaza arreglos/objetos y respeta el máximo', () => {
    assert.strictEqual(v.texto('  hola '), 'hola');
    assert.throws(() => v.texto(['a']), v.ErrorValidacion);
    assert.throws(() => v.texto({ a: 1 }), v.ErrorValidacion);
    assert.throws(() => v.texto('x'.repeat(11), { max: 10 }), v.ErrorValidacion);
    assert.throws(() => v.texto('', { requerido: true }), v.ErrorValidacion);
  });
  await prueba('booleano y fecha', () => {
    assert.strictEqual(v.booleano('true'), true);
    assert.strictEqual(v.booleano(false), false);
    assert.strictEqual(v.booleano(undefined), null);
    assert.throws(() => v.booleano('si'), v.ErrorValidacion);
    assert.strictEqual(v.fechaISO('2026-11-03'), '2026-11-03');
    assert.throws(() => v.fechaISO("2026-11-03' OR 1=1"), v.ErrorValidacion);
  });
  await prueba('tomar descarta campos no permitidos (receptor_id, firmado_en, __proto__...)', () => {
    const entrada = JSON.parse('{"nombre":"a","firmado_en":"2020-01-01","quien_recibe_id":1,"__proto__":{"admin":true}}');
    const salida = v.tomar(entrada, ['nombre']);
    assert.deepStrictEqual(Object.keys(salida), ['nombre']);
    assert.strictEqual(({}).admin, undefined);
  });
  await prueba('escaparLike neutraliza % y _', () => {
    assert.strictEqual(v.escaparLike('50%_a\\b'), '50\\%\\_a\\\\b');
  });
  await prueba('parametro ignora arreglos (?a=1&a=2)', () => {
    assert.strictEqual(v.parametro(['1', '2']), '');
    assert.strictEqual(v.parametro(' abc '), 'abc');
  });

  // ------------------------------------------------------------------ límites
  console.log('Límite de peticiones');
  const { crearLimitador, crearLimitadorFallos } = require('../middleware/limitadores');
  await prueba('la petición 4 de 3 recibe 429 con Retry-After', () => {
    const lim = crearLimitador({ ventanaMs: 60000, max: 3, clave: () => 'k' });
    let r;
    for (let i = 0; i < 4; i++) { r = respuesta(); lim({}, r, siguiente()); }
    assert.strictEqual(r.codigo, 429);
    assert.ok(Number(r.cabeceras['retry-after']) >= 1);
  });
  await prueba('cada llave cuenta por separado', () => {
    const lim = crearLimitador({ ventanaMs: 60000, max: 1, clave: (req) => req.k });
    const a = respuesta(); lim({ k: 'a' }, a, siguiente());
    const b = respuesta(); const nb = siguiente(); lim({ k: 'b' }, b, nb);
    assert.ok(nb.llamado);
  });
  await prueba('la ventana se reinicia', async () => {
    const lim = crearLimitador({ ventanaMs: 40, max: 1, clave: () => 'k' });
    lim({}, respuesta(), siguiente());
    const bloqueada = respuesta(); lim({}, bloqueada, siguiente());
    assert.strictEqual(bloqueada.codigo, 429);
    await new Promise((r) => setTimeout(r, 60));
    const n = siguiente(); lim({}, respuesta(), n);
    assert.ok(n.llamado);
  });
  await prueba('límite de fallos: bloquea al llegar al máximo y se limpia con éxito', () => {
    const f = crearLimitadorFallos({ ventanaMs: 60000, max: 3 });
    for (let i = 0; i < 2; i++) f.fallo('u');
    assert.strictEqual(f.bloqueado('u'), 0);
    f.fallo('u');
    assert.ok(f.bloqueado('u') > 0);
    f.exito('u');
    assert.strictEqual(f.bloqueado('u'), 0);
  });

  // ------------------------------------------------------------------ PDF
  console.log('Archivos PDF');
  const { esPdfReal } = require('../utils/pdf');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-'));
  await prueba('acepta un PDF real y rechaza un archivo disfrazado', () => {
    const bueno = path.join(tmp, 'a.pdf'); fs.writeFileSync(bueno, '%PDF-1.7\n...');
    const falso = path.join(tmp, 'b.pdf'); fs.writeFileSync(falso, '<?php system($_GET["x"]); ?>');
    const corto = path.join(tmp, 'c.pdf'); fs.writeFileSync(corto, '%PD');
    assert.ok(esPdfReal(bueno));
    assert.ok(!esPdfReal(falso));
    assert.ok(!esPdfReal(corto));
    assert.ok(!esPdfReal(path.join(tmp, 'no-existe.pdf')));
  });
  fs.rmSync(tmp, { recursive: true, force: true });

  // ------------------------------------------------------------------ HTTPS, CORS, cabeceras, errores
  console.log('HTTPS, CORS, cabeceras y errores');
  const seg = require('../middleware/seguridad');
  await prueba('HTTP + GET se redirige a HTTPS (308)', () => {
    const r = respuesta(); const n = siguiente();
    seg.forzarHttps({ secure: false, headers: { host: 'api.ejemplo.gob.mx' }, path: '/api/x', method: 'GET', originalUrl: '/api/x?a=1' }, r, n);
    assert.strictEqual(r.codigo, 308);
    assert.strictEqual(r.redirigido, 'https://api.ejemplo.gob.mx/api/x?a=1');
    assert.ok(!n.llamado);
  });
  await prueba('HTTP + POST se rechaza (no se repite en claro)', () => {
    const r = respuesta(); const n = siguiente();
    seg.forzarHttps({ secure: false, headers: { host: 'api.ejemplo.gob.mx' }, path: '/api/auth/login', method: 'POST', originalUrl: '/api/auth/login' }, r, n);
    assert.strictEqual(r.codigo, 403);
    assert.ok(!n.llamado);
  });
  await prueba('detrás del proxy (X-Forwarded-Proto: https) pasa y agrega HSTS', () => {
    const r = respuesta(); const n = siguiente();
    seg.forzarHttps({ secure: false, headers: { 'x-forwarded-proto': 'https' }, path: '/api/x', method: 'POST' }, r, n);
    assert.ok(n.llamado);
    assert.ok(/max-age=\d+/.test(r.cabeceras['strict-transport-security']));
  });
  await prueba('la ruta de salud "/" no se redirige (balanceadores)', () => {
    const r = respuesta(); const n = siguiente();
    seg.forzarHttps({ secure: false, headers: {}, path: '/', method: 'GET' }, r, n);
    assert.ok(n.llamado);
  });
  await prueba('el Host malicioso no se usa para redirigir', () => {
    const r = respuesta(); const n = siguiente();
    seg.forzarHttps({ secure: false, headers: { host: 'evil.com/\r\nX: y' }, path: '/a', method: 'GET', originalUrl: '/a' }, r, n);
    assert.strictEqual(r.codigo, 403);
  });
  await prueba('CORS: solo los orígenes configurados', () => {
    const decide = (origin) => { let res; seg.corsOpciones.origin(origin, (e, ok) => { res = ok; }); return res; };
    assert.strictEqual(decide('https://app.ejemplo.gob.mx'), true);
    assert.strictEqual(decide('http://localhost:5173'), true);
    assert.strictEqual(decide('https://evil.com'), false);
    assert.strictEqual(decide('null'), false);
    assert.strictEqual(decide(undefined), true);
    assert.strictEqual(seg.corsOpciones.credentials, true);
  });
  await prueba('cabeceras de seguridad presentes', () => {
    const r = respuesta(); seg.cabecerasSeguras({}, r, siguiente());
    for (const h of ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'content-security-policy', 'permissions-policy']) {
      assert.ok(r.cabeceras[h], h);
    }
  });
  await prueba('limpiarBody quita __proto__/constructor y crea body vacío si no hay', () => {
    const req = { body: JSON.parse('{"a":{"__proto__":{"x":1},"constructor":2,"ok":3}}') };
    seg.limpiarBody(req, respuesta(), siguiente());
    assert.deepStrictEqual(Object.keys(req.body.a), ['ok']);
    const req2 = {}; seg.limpiarBody(req2, respuesta(), siguiente());
    assert.deepStrictEqual(req2.body, {});
  });
  await prueba('un error interno no filtra detalles', () => {
    const r = respuesta(); const original = console.error; console.error = () => {};
    seg.manejarErrores(new Error('password=secreto en la tabla usuarios'), {}, r, siguiente());
    console.error = original;
    assert.strictEqual(r.codigo, 500);
    assert.ok(!JSON.stringify(r.cuerpo).includes('secreto'));
  });
  await prueba('JSON mal formado -> 400, archivo inexistente -> 404', () => {
    const a = respuesta(); seg.manejarErrores({ type: 'entity.parse.failed' }, {}, a, siguiente());
    assert.strictEqual(a.codigo, 400);
    const b = respuesta(); seg.manejarErrores({ status: 404 }, {}, b, siguiente());
    assert.strictEqual(b.codigo, 404);
  });

  // ------------------------------------------------------------------ bots
  console.log('Protección contra bots');
  const bots = require('../middleware/bots');
  const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
  await prueba('la trampa (campo oculto) rechaza al bot', () => {
    const r = respuesta(); const n = siguiente();
    bots.bloquearAutomatizacion({ body: { sitio_web: 'http://spam.com' }, headers: { 'user-agent': chrome } }, r, n);
    assert.strictEqual(r.codigo, 400); assert.ok(!n.llamado);
  });
  await prueba('un navegador normal pasa', () => {
    const r = respuesta(); const n = siguiente();
    bots.bloquearAutomatizacion({ body: { sitio_web: '' }, headers: { 'user-agent': chrome } }, r, n);
    assert.ok(n.llamado);
  });
  await prueba('sin User-Agent o con herramientas de ataque -> 403', () => {
    for (const ua of [undefined, 'sqlmap/1.7', 'python-requests/2.31', 'curl/8.4.0', 'Nikto/2.5']) {
      const r = respuesta(); const n = siguiente();
      bots.bloquearAutomatizacion({ body: {}, headers: ua ? { 'user-agent': ua } : {} }, r, n);
      assert.strictEqual(r.codigo, 403, String(ua)); assert.ok(!n.llamado);
    }
  });
  await prueba('Turnstile: sin clave configurada no estorba', async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const n = siguiente(); await bots.verificarTurnstile({ body: {} }, respuesta(), n);
    assert.ok(n.llamado);
  });
  await prueba('Turnstile configurado: exige token y lo valida contra Cloudflare', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secreto-de-prueba';
    const original = global.fetch;
    try {
      let r = respuesta(); let n = siguiente();
      await bots.verificarTurnstile({ body: {}, ip: '1.1.1.1' }, r, n);
      assert.strictEqual(r.codigo, 400); assert.ok(!n.llamado);

      global.fetch = async () => ({ json: async () => ({ success: false }) });
      r = respuesta(); n = siguiente();
      await bots.verificarTurnstile({ body: { turnstileToken: 't' }, ip: '1.1.1.1' }, r, n);
      assert.strictEqual(r.codigo, 400); assert.ok(!n.llamado);

      global.fetch = async () => ({ json: async () => ({ success: true }) });
      r = respuesta(); n = siguiente();
      await bots.verificarTurnstile({ body: { turnstileToken: 't' }, ip: '1.1.1.1' }, r, n);
      assert.ok(n.llamado);

      global.fetch = async () => { throw new Error('sin red'); };
      const antes = console.error; console.error = () => {};
      r = respuesta(); n = siguiente();
      await bots.verificarTurnstile({ body: { turnstileToken: 't' }, ip: '1.1.1.1' }, r, n);
      console.error = antes;
      assert.strictEqual(r.codigo, 503); assert.ok(!n.llamado);
    } finally {
      global.fetch = original;
      delete process.env.TURNSTILE_SECRET_KEY;
    }
  });

  // ------------------------------------------------------------------ SQL parametrizado
  console.log('SQL parametrizado');
  await prueba('ninguna consulta mete datos del usuario dentro del texto SQL', () => {
    // Fragmentos que se arman SOLO con constantes del código o con listas blancas (nunca con datos del usuario)
    const PERMITIDOS = new Set([
      "condiciones.join(' OR ')", // condiciones fijas con marcadores $1, $2...
      'filtroMateria', // 'AND materia_id = $1' o ''
      "esMP ? 'WHERE mp_id = $1' : ''",
      'where', // WHERE armado con marcadores $n
      'COLUMNA_ENTREGA[tipo]', // columna elegida de una lista blanca (Object.hasOwn)
      'filtro', // 'AND d.creado_por = $2' o ''
      "table_name.replace(/\"/g, '\"\"')", // nombre de tabla leído de information_schema, con comillas escapadas
    ]);
    const base = path.join(__dirname, '..');
    const archivos = ['index.js', ...fs.readdirSync(path.join(base, 'routes')).map((f) => `routes/${f}`)];
    const malos = [];
    for (const rel of archivos) {
      const src = fs.readFileSync(path.join(base, rel), 'utf8');
      const re = /\.query\(\s*`/g;
      let m;
      while ((m = re.exec(src))) {
        const fin = src.indexOf('`', re.lastIndex);
        const cuerpo = src.slice(re.lastIndex, fin);
        for (const e of cuerpo.matchAll(/\$\{([^}]*)\}/g)) {
          if (!PERMITIDOS.has(e[1].trim())) malos.push(`${rel}: \${${e[1]}}`);
        }
      }
    }
    assert.deepStrictEqual(malos, [], 'SQL con datos interpolados:\n' + malos.join('\n'));
  });

  console.log(`\n${total - fallas.length}/${total} pruebas correctas`);
  if (fallas.length) {
    console.log('Fallaron:\n - ' + fallas.join('\n - '));
    process.exit(1);
  }
})();
