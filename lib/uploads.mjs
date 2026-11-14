export async function upload(file, imagesOnly = false) {
  if (file == null || file === '' || file instanceof File && file.size === 0) return null;
  if (!(file instanceof File)) throw new Error('Choose a permitted file.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Files must be 2 MB or smaller.');
  const data = Buffer.from(await file.arrayBuffer());
  let mime, extension;
  if (data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {mime='image/png';extension='png';}
  else if (data[0]===255 && data[1]===216 && data[2]===255) {mime='image/jpeg';extension='jpg';}
  else if (data.subarray(0,5).toString()==='%PDF-') {mime='application/pdf';extension='pdf';}
  if (!mime || imagesOnly && mime==='application/pdf') throw new Error('Only PNG, JPEG'+(imagesOnly?'':' and PDF')+' files are permitted.');
  // Names are metadata, never filesystem paths. Force extension to match detected type.
  const stem=file.name.replace(/[^a-zA-Z0-9._ -]/g,'_').replace(/^\.+/,'').replace(/\.[^.]*$/,'').slice(0,110)||'attachment';
  return {data,mime,name:stem+'.'+extension};
}
