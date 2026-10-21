import sharp from 'sharp';
export async function cleanPatientPhoto(value){
 if(value==='')return '';
 if(typeof value!=='string'||value.length>2900000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))throw new Error('Choose a PNG, JPEG or WebP patient photo up to 2 MB');
 const data=Buffer.from(value.split(',')[1],'base64');if(data.length>2*1024*1024)throw new Error('Patient photo must be 2 MB or smaller');
 try{const image=sharp(data,{limitInputPixels:16000000,animated:false}),meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)throw new Error();return 'data:image/webp;base64,'+(await image.rotate().resize(160,160,{fit:'cover'}).webp({quality:80}).toBuffer()).toString('base64')}catch{throw new Error('Invalid patient photo. Use a static PNG, JPEG or WebP.')}
}
