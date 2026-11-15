/**
 * ============================================================================
 *  BACKEND DE LA SORPRESA 12/12  ·  Google Apps Script + Google Sheets
 * ============================================================================
 *  - Script LIGADO a la hoja de cálculo (Extensiones → Apps Script).
 *  - Se publica como Aplicación web (ver GUIA_12-12.md).
 *  - La página pública SOLO puede:   GET ?action=estado   → ¿está habilitado?
 *                                    GET ?action=carta    → la carta (solo si está habilitado)
 *  - Cambiar el estado exige POST con la clave de administrador, que se valida AQUÍ,
 *    en el servidor. La clave vive en "Propiedades de la secuencia de comandos"
 *    (ADMIN_KEY): nunca en el HTML, nunca en el JavaScript público.
 *  - La carta se guarda en la hoja CARTA_12 y NO viaja en el HTML: mientras el 12
 *    esté bloqueado, nadie puede leerla manipulando el navegador.
 * ============================================================================
 */

// ----------------------------- Nombres y ajustes -----------------------------
var HOJA_CONFIG = 'CONFIGURACION';
var HOJA_EVENTOS = 'EVENTOS';
var HOJA_CARTA = 'CARTA_12';
var HOJA_REGISTRO = 'REGISTRO';
var ZONA = 'America/El_Salvador';

var CACHE_ESTADO_SEG = 5;        // el estado público se cachea unos segundos (protege la cuota)
var MAX_FALLOS = 5;              // intentos de clave erróneos permitidos...
var VENTANA_FALLOS_SEG = 900;    // ...dentro de esta ventana; luego se bloquea el panel ese tiempo
var MAX_BODY = 1000;             // tamaño máximo aceptado en un POST

var MENSAJE_BLOQUEO_DEFECTO = 'Espera un poquito... todavía falta algo. ❤️';

// Texto de la sorpresa (solo se usa para rellenar la hoja CARTA_12 la primera vez;
// después puedes editarlo directamente en la hoja).
var CARTA_DEFECTO = {
  titulo: 'Quizá...',
  parrafos: [
    'Quizá desde que comenzamos a hablar, la conexión entre nosotros no tardó en llegar. Quizá ninguno de los dos imaginaba hasta dónde nos llevaría aquella primera conversación.',
    'No voy a olvidar el primer día que nos vimos, tampoco nuestro primer beso, ni aquellos largos días y noches en los que podíamos pasar horas hablando sin cansarnos. Son recuerdos que guardo con muchísimo cariño y que, si pudiera, volvería a vivir una y mil veces.',
    'Sé que todavía puedes sentir incertidumbre, y es completamente normal. No pretendo que tengas todas las respuestas ni que dejes de tener miedo. Sé que construir una vida juntos es algo grande y que requiere tiempo, paciencia, comprensión y, sobre todo, amor.',
    'Pero hay algo de lo que estoy seguro: no me imagino a ninguna otra mujer a mi lado que no seas tú.',
    'No quiero prometerte que todos nuestros días serán perfectos, porque sé que habrá dificultades, desacuerdos y momentos en los que las cosas no serán sencillas. Pero sí quiero prometerte que mi intención es elegirte incluso en esos días, escucharte, comprenderte, respetarte y seguir construyendo contigo.',
    'Quiero ser esa persona con la que puedas compartir tus alegrías, tus tristezas, tus sueños y hasta tus pequeños momentos cotidianos. Quiero conocer cada versión de ti, acompañarte en tus metas, celebrar tus logros y sostener tu mano cuando sientas que el mundo pesa demasiado.',
    'No quiero que seas solamente parte de mis mejores recuerdos; quiero que seas parte de mis próximos capítulos. Quiero que algún día podamos mirar atrás y recordar cómo comenzó todo, cuánto hemos crecido y todo lo que logramos construir juntos.',
    'No sé qué nos tenga preparado el futuro, pero sé lo que deseo para él: que sigamos caminando juntos, que nunca perdamos las ganas de enamorarnos el uno del otro y que, con el paso de los años, sigamos encontrando razones para elegirnos.',
    'Porque si algo tengo claro es que no solamente quiero compartir contigo un noviazgo, quiero construir una vida a tu lado.',
    'Gracias por esta bendición y por permitirme ser tu novio. ❤️'
  ],
  cierre: 'Ahora sí... creo que ya puedo cambiar mi estado de GitHub a comprometido: en una relación. JAJAJA. ❤️'
};

// =============================== PUNTOS DE ENTRADA ===============================

/** Consultas públicas (solo lectura). */
function doGet(e) {
  try {
    var accion = e && e.parameter && e.parameter.action ? String(e.parameter.action) : '';
    if (accion === 'estado') return json_(estadoPublico_());
    if (accion === 'carta') return json_(cartaPublica_());
    return json_({ ok: false, error: 'accion' });
  } catch (err) {
    console.error('doGet: ' + err);
    return json_({ ok: false, error: 'interno' });
  }
}

/** Operaciones administrativas (requieren clave validada en el servidor). */
function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
    if (!raw || raw.length > MAX_BODY) return json_({ ok: false, error: 'formato' });
    var datos;
    try { datos = JSON.parse(raw); } catch (x) { return json_({ ok: false, error: 'formato' }); }
    if (!datos || typeof datos !== 'object') return json_({ ok: false, error: 'formato' });

    var accion = String(datos.action || '');
    if (accion !== 'habilitar' && accion !== 'bloquear') return json_({ ok: false, error: 'accion' });
    return json_(cambiarEstado_(accion, String(datos.clave || '')));
  } catch (err) {
    console.error('doPost: ' + err);
    return json_({ ok: false, error: 'interno' });
  }
}

// ================================ LÓGICA PÚBLICA ================================

function estadoPublico_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('estado_v1');
  if (hit) { try { return JSON.parse(hit); } catch (x) { /* se recalcula */ } }
  var cfg = leerConfig_();
  var out = {
    ok: true,
    habilitado_12: esVerdadero_(cfg.habilitado_12),
    mensaje_bloqueo: String(cfg.mensaje_bloqueo || MENSAJE_BLOQUEO_DEFECTO),
    actualizado: String(cfg.ultima_actualizacion || '')
  };
  cache.put('estado_v1', JSON.stringify(out), CACHE_ESTADO_SEG);
  return out;
}

/** La carta SOLO se entrega si el 12 está habilitado (se lee siempre de la hoja, sin caché). */
function cartaPublica_() {
  var cfg = leerConfig_();
  if (!esVerdadero_(cfg.habilitado_12)) return { ok: true, habilitado_12: false };
  var filas = hoja_(HOJA_CARTA).getDataRange().getValues();
  var titulo = '', cierre = '', parrafos = [], orden = [];
  for (var i = 1; i < filas.length; i++) {
    var tipo = String(filas[i][1]).trim().toLowerCase();
    var texto = String(filas[i][2]);
    if (!texto) continue;
    if (tipo === 'titulo') titulo = texto;
    else if (tipo === 'cierre') cierre = texto;
    else if (tipo === 'parrafo') orden.push({ n: Number(filas[i][0]) || (i * 1000), t: texto });
  }
  orden.sort(function (a, b) { return a.n - b.n; });
  parrafos = orden.map(function (o) { return o.t; });
  return { ok: true, habilitado_12: true, titulo: titulo, parrafos: parrafos, cierre: cierre };
}

// ============================ OPERACIÓN ADMINISTRATIVA ============================

function cambiarEstado_(accion, clave) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return { ok: false, error: 'ocupado' };
  try {
    var cache = CacheService.getScriptCache();
    var esperada = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
    if (!esperada) { registrar_(accion, 'RECHAZADO: sin ADMIN_KEY'); return { ok: false, error: 'sin-clave' }; }

    // límite de intentos fallidos
    var fallos = Number(cache.get('fallos') || 0);
    if (fallos >= MAX_FALLOS) { registrar_(accion, 'RECHAZADO: bloqueo temporal'); return { ok: false, error: 'bloqueado' }; }

    if (!clave || !iguales_(clave, esperada)) {
      cache.put('fallos', String(fallos + 1), VENTANA_FALLOS_SEG);
      registrar_(accion, 'RECHAZADO: clave incorrecta (' + (fallos + 1) + '/' + MAX_FALLOS + ')');
      Utilities.sleep(700);   // frena la fuerza bruta
      return { ok: false, error: 'clave' };
    }
    cache.remove('fallos');

    var habilitar = accion === 'habilitar';
    var ahora = marca_();
    escribirConfig_('habilitado_12', habilitar ? 'TRUE' : 'FALSE');
    escribirConfig_('ultima_actualizacion', ahora);
    escribirConfig_('fecha_activacion', habilitar ? ahora : '');
    actualizarEvento_(habilitar ? 'HABILITADO' : 'BLOQUEADO', ahora);
    cache.remove('estado_v1');
    registrar_(accion, 'OK');
    return { ok: true, habilitado_12: habilitar, actualizado: ahora };
  } finally {
    lock.releaseLock();
  }
}

// ================================== UTILIDADES ==================================

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function esVerdadero_(v) { return String(v).trim().toUpperCase() === 'TRUE'; }
function marca_() { return Utilities.formatDate(new Date(), ZONA, "yyyy-MM-dd'T'HH:mm:ssXXX"); }

function digest_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8); }
/** Comparación en tiempo constante (sobre los hashes SHA-256). */
function iguales_(a, b) {
  var da = digest_(a), db = digest_(b), d = 0;
  for (var i = 0; i < da.length; i++) d |= (da[i] ^ db[i]);
  return d === 0;
}

function libro_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');   // solo si el script NO está ligado a la hoja
  if (!id) throw new Error('No hay hoja de cálculo asociada (define SHEET_ID).');
  return SpreadsheetApp.openById(id);
}
function hoja_(nombre) {
  var sh = libro_().getSheetByName(nombre);
  if (!sh) throw new Error('Falta la hoja ' + nombre + ' (ejecuta inicializar()).');
  return sh;
}

function leerConfig_() {
  var v = hoja_(HOJA_CONFIG).getDataRange().getValues(), o = {};
  for (var i = 1; i < v.length; i++) { var k = String(v[i][0]).trim(); if (k) o[k] = v[i][1]; }
  return o;
}
function escribirConfig_(clave, valor) {
  var sh = hoja_(HOJA_CONFIG), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === clave) { sh.getRange(i + 1, 2).setValue(valor); return; }
  }
  sh.appendRow([clave, valor]);
}
function actualizarEvento_(estado, ahora) {
  var sh = hoja_(HOJA_EVENTOS), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][1]).trim() === '12/12') { sh.getRange(i + 1, 3).setValue(estado); sh.getRange(i + 1, 5).setValue(ahora); return; }
  }
  sh.appendRow([v.length, '12/12', estado, 'Sorpresa especial', ahora]);
}
/** Bitácora de operaciones administrativas (nunca guarda la clave). */
function registrar_(accion, resultado) {
  try { hoja_(HOJA_REGISTRO).appendRow([marca_(), accion, resultado]); } catch (x) { console.error('registro: ' + x); }
}

// ============================ CONFIGURACIÓN INICIAL ============================
/**
 * Ejecuta esta función UNA vez desde el editor (▶ Ejecutar → inicializar).
 * Crea las hojas y las rellena. Es seguro repetirla: no pisa datos que ya existan,
 * y NUNCA cambia el valor de habilitado_12.
 */
function inicializar() {
  var ss = libro_();
  function obtener(nombre) { return ss.getSheetByName(nombre) || ss.insertSheet(nombre); }

  var cfg = obtener(HOJA_CONFIG);
  if (cfg.getLastRow() === 0) cfg.appendRow(['Parámetro', 'Valor']);
  cfg.getRange('B:B').setNumberFormat('@');            // texto plano: evita que Sheets convierta fechas/TRUE
  var existentes = leerConfig_();
  var base = [
    ['fecha_especial', '12/12'],
    ['habilitado_12', 'FALSE'],
    ['mensaje_bloqueo', MENSAJE_BLOQUEO_DEFECTO],
    ['ultima_actualizacion', ''],
    ['fecha_activacion', '']
  ];
  base.forEach(function (par) { if (!(par[0] in existentes)) cfg.appendRow(par); });
  cfg.setFrozenRows(1);

  var ev = obtener(HOJA_EVENTOS);
  if (ev.getLastRow() === 0) { ev.appendRow(['ID', 'Fecha', 'Estado', 'Descripción', 'Actualizado']); ev.appendRow([1, '12/12', 'BLOQUEADO', 'Sorpresa especial', '']); }
  ev.setFrozenRows(1);

  var carta = obtener(HOJA_CARTA);
  if (carta.getLastRow() === 0) {
    carta.appendRow(['Orden', 'Tipo', 'Texto']);
    carta.appendRow([0, 'titulo', CARTA_DEFECTO.titulo]);
    CARTA_DEFECTO.parrafos.forEach(function (p, i) { carta.appendRow([i + 1, 'parrafo', p]); });
    carta.appendRow([99, 'cierre', CARTA_DEFECTO.cierre]);
  }
  carta.setFrozenRows(1);

  var reg = obtener(HOJA_REGISTRO);
  if (reg.getLastRow() === 0) reg.appendRow(['Fecha y hora', 'Acción', 'Resultado']);
  reg.setFrozenRows(1);

  verificarConfiguracion();
}

/** Revisa que todo esté listo (no imprime la clave). */
function verificarConfiguracion() {
  var tieneClave = !!PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  var cfg = leerConfig_();
  console.log('ADMIN_KEY configurada: ' + (tieneClave ? 'SÍ' : 'NO  ← añádela en Configuración del proyecto → Propiedades de la secuencia de comandos'));
  console.log('habilitado_12 = ' + cfg.habilitado_12);
  console.log('Hojas: ' + libro_().getSheets().map(function (s) { return s.getName(); }).join(', '));
}
