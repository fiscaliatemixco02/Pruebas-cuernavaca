// reorganizar.mjs
//
// Mueve las pantallas del frontend a una carpeta por rol y corrige solos todos los imports.
//
// Uso (desde la carpeta frontend):
//   node reorganizar.mjs             -> solo MUESTRA lo que haría (no cambia nada)
//   node reorganizar.mjs --aplicar   -> mueve los archivos y corrige los imports
//
// Después:  npm run build   (si hay un import roto, aquí sale)

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('src');
const APLICAR = process.argv.includes('--aplicar');

if (!fs.existsSync(SRC)) {
  console.error('No encuentro la carpeta "src". Ejecuta este script desde la carpeta frontend.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// QUÉ SE MUEVE Y A DÓNDE   (rutas relativas a src/)
// ---------------------------------------------------------------------------
const MOVER = {
  // Acceso
  'paginas/login.jsx': 'paginas/auth/login.jsx',
  'paginas/Auth.css': 'paginas/auth/Auth.css',

  // Ministerio Público
  'paginas/solicitudMP.Jsx': 'paginas/mp/SolicitudMP.jsx',
  'paginas/OrdenInvestigacion.jsx': 'paginas/mp/OrdenInvestigacion.jsx',
  'paginas/CarpetasMP.jsx': 'paginas/mp/CarpetasMP.jsx',

  // Receptor (y Administrador)
  'paginas/solicitudesRecibidas.jsx': 'paginas/receptor/SolicitudesRecibidas.jsx',

  // AIC
  'paginas/OrdenesInvestigacionRecibidas.jsx': 'paginas/aic/OrdenesInvestigacionRecibidas.jsx',
  'paginas/AtenderOrdenInvestigacion.jsx': 'paginas/aic/AtenderOrdenInvestigacion.jsx',
  'paginas/AtenderOrden.css': 'paginas/aic/AtenderOrden.css',

  // Perito y Policía
  'paginas/Notificaciones.jsx': 'paginas/perito/Notificaciones.jsx',
  'paginas/Notificaciones.css': 'paginas/perito/Notificaciones.css',
  'paginas/PeticionPerito.jsx': 'paginas/perito/PeticionPerito.jsx',

  // Administrador
  'paginas/Usuarios.jsx': 'paginas/admin/Usuarios.jsx',
  'paginas/CrearCuenta.jsx': 'paginas/admin/CrearCuenta.jsx',
  'paginas/Bitacora.jsx': 'paginas/admin/Bitacora.jsx',
  'paginas/Respaldo.jsx': 'paginas/admin/Respaldo.jsx',

  // Varios roles
  'paginas/Home.jsx': 'paginas/compartidas/Home.jsx',
  'paginas/Home.css': 'paginas/compartidas/Home.css',
  'paginas/BuscarPeticion.jsx': 'paginas/compartidas/BuscarPeticion.jsx',
  'paginas/Carpetas.jsx': 'paginas/compartidas/Carpetas.jsx',
  'paginas/PorFirmar.jsx': 'paginas/compartidas/PorFirmar.jsx',
  'paginas/EditarPeticion.jsx': 'paginas/compartidas/EditarPeticion.jsx',
  'paginas/NuevaPeticion.jsx': 'paginas/compartidas/NuevaPeticion.jsx',
  'paginas/PeticionWizard.jsx': 'paginas/compartidas/PeticionWizard.jsx',
  'paginas/Estadisticas.jsx': 'paginas/compartidas/Estadisticas.jsx',
  'paginas/Estadisticas.css': 'paginas/compartidas/Estadisticas.css',

  // Permisos (junto a la configuración)
  'paginas/permisos.jsx': 'config/permisos.jsx',
};

// ---------------------------------------------------------------------------
const EXT_CODIGO = new Set(['.js', '.jsx', '.mjs']);
const EXT_PROBAR = ['', '.jsx', '.js', '.css', '.mjs', '.json'];

function listar(dir, salida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listar(p, salida);
    else salida.push(p);
  }
  return salida;
}

const rel = (f) => path.relative(SRC, f).split(path.sep).join('/');
const archivos = listar(SRC);
// Búsqueda sin importar mayúsculas (así se encuentra solicitudMP.Jsx aunque se importe como SolicitudMP)
const porMinuscula = new Map(archivos.map((f) => [f.toLowerCase(), f]));

// mapa: ruta real vieja -> ruta nueva
const mapa = new Map();
const nuevos = new Set();
let problemas = 0;

for (const [de, a] of Object.entries(MOVER)) {
  const real = porMinuscula.get(path.join(SRC, de).toLowerCase());
  if (!real) {
    console.warn(`  (no existe, se omite)  ${de}`);
    continue;
  }
  const destino = path.join(SRC, a);
  const existente = porMinuscula.get(destino.toLowerCase());
  if (existente && existente !== real) {
    console.error(`  ERROR: ya existe un archivo en el destino ${a}`);
    problemas++;
    continue;
  }
  if (nuevos.has(destino.toLowerCase())) {
    console.error(`  ERROR: dos archivos van al mismo destino ${a}`);
    problemas++;
    continue;
  }
  nuevos.add(destino.toLowerCase());
  mapa.set(real, destino);
}

if (problemas) {
  console.error('\nHay errores en el plan. No se hizo ningún cambio.');
  process.exit(1);
}

function resolver(desdeArchivo, spec) {
  const base = path.resolve(path.dirname(desdeArchivo), spec);
  for (const e of EXT_PROBAR) {
    const c = porMinuscula.get((base + e).toLowerCase());
    if (c) return { archivo: c, ext: e };
  }
  for (const e of ['.jsx', '.js']) {
    const c = porMinuscula.get(path.join(base, 'index' + e).toLowerCase());
    if (c) return { archivo: c, ext: 'index' };
  }
  return null;
}

function especificadorNuevo(importadorNuevo, objetivoNuevo, ext) {
  let r;
  if (ext === 'index') {
    r = path.relative(path.dirname(importadorNuevo), path.dirname(objetivoNuevo));
  } else {
    r = path.relative(path.dirname(importadorNuevo), objetivoNuevo);
    // Si el import original no llevaba extensión, tampoco se la ponemos
    if (ext !== '') r = r.slice(0, r.length - path.extname(objetivoNuevo).length);
  }
  r = r.split(path.sep).join('/');
  if (r === '') r = '.';
  if (!r.startsWith('.')) r = './' + r;
  return r;
}

// import x from "./a"   import "./a.css"   export ... from "./a"   import("./a")
const PATRONES = [
  /(\bfrom\s*)(['"])(\.{1,2}\/[^'"\n]+|\.{1,2})\2/g,
  /(\bimport\s*)(['"])(\.{1,2}\/[^'"\n]+)\2/g,
  /(\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"\n]+)\2/g,
];

const cambios = []; // { archivo (viejo), texto }
const detalle = [];
const sinResolver = [];

for (const f of archivos) {
  if (!EXT_CODIGO.has(path.extname(f).toLowerCase())) continue;
  const original = fs.readFileSync(f, 'utf8');
  const importadorNuevo = mapa.get(f) ?? f;
  let texto = original;

  for (const patron of PATRONES) {
    texto = texto.replace(patron, (todo, antes, comilla, spec) => {
      const res = resolver(f, spec);
      if (!res) {
        sinResolver.push(`${rel(f)}  ->  ${spec}`);
        return todo;
      }
      const objetivoNuevo = mapa.get(res.archivo) ?? res.archivo;
      if (importadorNuevo === f && objetivoNuevo === res.archivo) return todo; // no cambia nada
      const nuevo = especificadorNuevo(importadorNuevo, objetivoNuevo, res.ext);
      if (nuevo === spec) return todo;
      detalle.push(`${rel(f)}:  ${spec}  ->  ${nuevo}`);
      return `${antes}${comilla}${nuevo}${comilla}`;
    });
  }
  if (texto !== original) cambios.push({ archivo: f, texto });
}

// Avisos para CSS que se mueven con rutas relativas adentro
const avisosCss = [];
for (const [viejo] of mapa) {
  if (path.extname(viejo).toLowerCase() !== '.css') continue;
  const css = fs.readFileSync(viejo, 'utf8');
  if (/@import/.test(css) || /url\(\s*['"]?(?!data:|https?:|\/|#)/.test(css)) {
    avisosCss.push(rel(viejo));
  }
}

// Quién usa cada archivo de reutilizables (para decidir después si alguno es de un solo rol)
const usadoPor = new Map();
for (const f of archivos) {
  if (!EXT_CODIGO.has(path.extname(f).toLowerCase())) continue;
  const texto = fs.readFileSync(f, 'utf8');
  for (const patron of PATRONES) {
    for (const m of texto.matchAll(patron)) {
      const res = resolver(f, m[3]);
      if (res && rel(res.archivo).startsWith('reutilizables/')) {
        const k = rel(res.archivo);
        if (!usadoPor.has(k)) usadoPor.set(k, new Set());
        usadoPor.get(k).add(rel(mapa.get(f) ?? f));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// INFORME
// ---------------------------------------------------------------------------
console.log(`\n${APLICAR ? 'APLICANDO' : 'SIMULACIÓN (no se cambia nada)'}\n`);
console.log(`Archivos que se mueven: ${mapa.size}`);
for (const [v, n] of mapa) console.log(`  ${rel(v)}  ->  ${rel(n)}`);
console.log(`\nImports que se corrigen: ${detalle.length}`);
for (const d of detalle) console.log(`  ${d}`);

if (sinResolver.length) {
  console.log(`\nImports relativos que NO pude resolver (revísalos a mano, no los toqué): ${sinResolver.length}`);
  for (const s of sinResolver) console.log(`  ${s}`);
}
if (avisosCss.length) {
  console.log('\nAVISO: estos CSS se mueven y tienen @import o url() con ruta relativa; revísalos:');
  for (const c of avisosCss) console.log(`  ${c}`);
}
console.log('\nQuién usa cada archivo de reutilizables:');
for (const [k, set] of [...usadoPor].sort()) {
  console.log(`  ${k}  <-  ${[...set].join(', ')}`);
}

if (!APLICAR) {
  console.log('\nSi todo se ve bien:  node reorganizar.mjs --aplicar');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// APLICAR: primero se reescriben los textos (en su ruta vieja) y luego se mueve
// ---------------------------------------------------------------------------
for (const c of cambios) fs.writeFileSync(c.archivo, c.texto, 'utf8');
for (const [viejo, nuevo] of mapa) {
  fs.mkdirSync(path.dirname(nuevo), { recursive: true });
  fs.renameSync(viejo, nuevo);
}

// ---------------------------------------------------------------------------
// VERIFICACIÓN: todos los imports relativos deben existir con las mayúsculas EXACTAS
// ---------------------------------------------------------------------------
const finales = listar(SRC);
const exactos = new Set(finales);
let revisados = 0;
const rotos = [];
for (const f of finales) {
  if (!EXT_CODIGO.has(path.extname(f).toLowerCase())) continue;
  const texto = fs.readFileSync(f, 'utf8');
  for (const patron of PATRONES) {
    for (const m of texto.matchAll(patron)) {
      revisados++;
      const base = path.resolve(path.dirname(f), m[3]);
      const ok =
        EXT_PROBAR.some((e) => exactos.has(base + e)) ||
        ['.jsx', '.js'].some((e) => exactos.has(path.join(base, 'index' + e)));
      if (!ok) rotos.push(`${rel(f)}  ->  ${m[3]}`);
    }
  }
}
console.log(`\nVERIFICACIÓN: ${revisados} imports revisados, ${rotos.length} rotos.`);
for (const r of rotos) console.log(`  ROTO: ${r}`);
console.log('\nListo. Ahora ejecuta:  npm run build');
