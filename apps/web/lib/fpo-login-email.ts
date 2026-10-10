import { createHash } from 'node:crypto';

const stateCodes: Record<string,string> = {
  'tamil nadu':'tn','andhra pradesh':'ap','arunachal pradesh':'ar','assam':'as',
  'bihar':'br','chhattisgarh':'cg','goa':'ga','gujarat':'gj','haryana':'hr',
  'himachal pradesh':'hp','jharkhand':'jh','karnataka':'ka','kerala':'kl',
  'madhya pradesh':'mp','maharashtra':'mh','manipur':'mn','meghalaya':'ml',
  'mizoram':'mz','nagaland':'nl','odisha':'od','punjab':'pb','rajasthan':'rj',
  'sikkim':'sk','telangana':'ts','tripura':'tr','uttar pradesh':'up',
  'uttarakhand':'uk','west bengal':'wb','delhi':'dl','puducherry':'py',
  'jammu and kashmir':'jk','ladakh':'la','chandigarh':'ch','lakshadweep':'ld',
  'andaman and nicobar islands':'an','dadra and nagar haveli and daman and diu':'dn',
};
// Login identifiers are lowercase, ASCII, and within the 64-character local-part limit.
export function fpoLoginEmail(fpo: {id:string;name:string;district:string;state:string;taluk?:string|null}, disambiguate=false) {
  const clean = (value:string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const code = stateCodes[fpo.state.trim().toLowerCase()] || clean(fpo.state);
  const district = clean(fpo.district);
  const generatedName = fpo.name.startsWith('DigitalFPO_Cofarmz_');
  const group = generatedName ? (fpo.taluk ? clean(fpo.taluk) + district + code : district + code) : clean(fpo.name);
  const base = (generatedName ? 'cofarmzfpo' + group : group) || 'cofarmzfpo';
  const suffix = createHash('sha256').update(fpo.id).digest('hex').slice(0,12);
  const needsSuffix = disambiguate || !district || base.length > 64;
  return `${needsSuffix ? base.slice(0,51)+'-'+suffix : base}@cofarmz.com`;
}
