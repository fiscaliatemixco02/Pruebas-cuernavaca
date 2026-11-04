// backend/utils/pdf.js
//
// multer confía en el Content-Type que manda el navegador, que cualquiera puede falsificar.
// Aquí se revisa el contenido real: un PDF empieza con los bytes "%PDF-".

const fs = require('fs');

function esPdfReal(ruta) {
  let fd;
  try {
    fd = fs.openSync(ruta, 'r');
    const buf = Buffer.alloc(5);
    const leidos = fs.readSync(fd, buf, 0, 5, 0);
    return leidos === 5 && buf.toString('latin1') === '%PDF-';
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// true si TODOS los archivos subidos son PDF de verdad
const todosSonPdf = (archivos) => archivos.every((f) => esPdfReal(f.path));

module.exports = { esPdfReal, todosSonPdf };
