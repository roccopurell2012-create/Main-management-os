const LIMIT = 10 * 1024 * 1024;
const extOf = (name) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
const decodeText = (data) => {
  try {
    const value = new TextDecoder('utf-8', { fatal: true }).decode(data);
    return !value.includes('\u0000') && value.length > 0;
  } catch { return false; }
};
const zipHeader = (data) => data.length > 4 && data[0] === 0x50 && data[1] === 0x4b && [0x03,0x05,0x07].includes(data[2]);

export async function upload(file, imagesOnly = false) {
  if (file == null || file === '' || file instanceof File && file.size === 0) return null;
  if (!(file instanceof File)) throw new Error('Choose a permitted file.');
  if (file.size > LIMIT) throw new Error('Files must be 10 MB or smaller.');
  const data = Buffer.from(await file.arrayBuffer());
  const ext = extOf(file.name);
  let mime = null;
  const png = data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = data[0]===255 && data[1]===216 && data[2]===255;
  const pdf = data.subarray(0,5).toString()==='%PDF-';
  const formats = {
    txt: 'text/plain; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    dwg: 'application/acad',
    dxf: 'application/dxf',
    ifc: 'application/octet-stream',
    step: 'model/step',
    stp: 'model/step',
    stl: 'model/stl',
    obj: 'model/obj',
    skp: 'application/octet-stream',
  };
  if (ext === 'png' && png) mime = 'image/png';
  else if ((ext === 'jpg' || ext === 'jpeg') && jpeg) mime = 'image/jpeg';
  else if (ext === 'pdf' && pdf) mime = 'application/pdf';
  else if (['txt','csv','dxf','ifc','step','stp','obj'].includes(ext) && decodeText(data)) {
    if (ext === 'dxf' && !/SECTION|AutoCAD/i.test(data.subarray(0,2048).toString('utf8'))) throw new Error('That DXF file does not look valid.');
    if (['ifc','step','stp'].includes(ext) && !/ISO-10303-21|HEADER|DATA;/i.test(data.subarray(0,2048).toString('utf8'))) throw new Error('That model file does not look valid.');
    mime = ext === 'dxf' ? formats.dxf : ext === 'ifc' ? formats.ifc : ['step','stp'].includes(ext) ? formats[ext] : formats[ext];
  } else if (['docx','xlsx','pptx'].includes(ext) && zipHeader(data)) mime = formats[ext];
  else if (ext === 'dwg' && /^AC10[0-9A-Z]{2}/.test(data.subarray(0,6).toString('ascii'))) mime = formats.dwg;
  else if (ext === 'skp' && data.subarray(0,32).toString('utf8').startsWith('SketchUp Model')) mime = formats.skp;
  else if (ext === 'stl') {
    const text = data.subarray(0,512).toString('utf8').trimStart();
    const triangles = data.length >= 84 ? data.readUInt32LE(80) : 0;
    if (text.startsWith('solid') && /facet|endsolid/i.test(text)) mime = formats.stl;
    else if (84 + triangles * 50 === data.length) mime = formats.stl;
  }
  if (!mime || imagesOnly && !['image/png','image/jpeg'].includes(mime)) {
    throw new Error(imagesOnly
      ? 'Company logos must be PNG or JPEG images.'
      : 'Use PNG, JPEG, PDF, TXT, CSV, DOCX, XLSX, PPTX, DWG, DXF, IFC, STEP, STL, OBJ or SKP files.');
  }
  const stem = file.name.replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/^\.+/,'').replace(/\.[^.]*$/,'').slice(0,110)||'attachment';
  return {data,mime,name:stem+'.'+ext};
}
