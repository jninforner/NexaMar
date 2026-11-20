const ALLOWED_ORIGINS = new Set([
 'https://jninforner.github.io',
 'http://localhost:8000',
 'http://localhost:8001',
]);
const PROJECT = 'control-de-peixos';

function decodeBase64Url(str) { const b64=str.replace(/-/g,'+').replace(/_/g,'/'); const bin=atob(b64.padEnd(Math.ceil(b64.length/4)*4,'=')); return Uint8Array.from(bin,c=>c.charCodeAt(0)); }
async function verifyFirebaseToken(token) {
 const parts=token.split('.'); if(parts.length!==3) throw Error('Token incorrecte');
 const header=JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
 const payload=JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
 const now=Math.floor(Date.now()/1000);
 if(header.alg!=='RS256'||!header.kid||payload.aud!==PROJECT||payload.iss!==`https://securetoken.google.com/${PROJECT}`||!payload.sub||payload.exp<=now||payload.iat>now||payload.auth_time>now) throw Error('Sessió no vàlida');
 const r=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
 if(!r.ok) throw Error('No es poden verificar credencials');
 const jwks=await r.json(); const jwk=jwks.keys.find(k=>k.kid===header.kid); if(!jwk) throw Error('Clau de verificació desconeguda');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decodeBase64Url(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
 if(!ok) throw Error('Signatura invàlida');
 return payload;
}
export default { async fetch(request, env) {
 const origin = request.headers.get('Origin');
 const cors = { 'Vary': 'Origin' };
 const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
 });
 if (!ALLOWED_ORIGINS.has(origin)) return json({error:'Origen no permès'}, 403);
 cors['Access-Control-Allow-Origin'] = origin;
 cors['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
 cors['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
 if(request.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST') return json({error:'Mètode no admès'},405);
 if(!env.OPENAI_API_KEY) return json({error:'Falta configurar el secret OPENAI_API_KEY'},503);
 const bearer=request.headers.get('Authorization')||'';
 if(!bearer.startsWith('Bearer ')) return json({error:'Cal iniciar sessió'},401);
 try { await verifyFirebaseToken(bearer.slice(7)); } catch(e) { return json({error:'Sessió no vàlida. Torna a iniciar sessió.'},401); }
 if(Number(request.headers.get('Content-Length')||0)>12_000_000) return json({error:'Fitxer massa gran'},413);
 let body; try { body=await request.json(); } catch { return json({error:'JSON incorrecte'},400); }
 const {image,mimeType,headerImage}=body||{};
 const isPdf=mimeType==='application/pdf';
 if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(mimeType)||typeof image!=='string'||image.length>11_184_812||!(/^[A-Za-z0-9+/]+={0,2}$/).test(image)) return json({error:'Fitxer no vàlid o massa gran'},400);
 const instructions=`Interpreta un albarà de compra en imatge o PDF. Revisa totes les pàgines. Inclou cada línia de producte, també si és un article desconegut o es ven per unitats. Retorna NOMÉS un objecte JSON vàlid amb supplier (nom del proveïdor o cadena buida), invoiceNumber (número o referència inequívoca de l’albarà o cadena buida), date (YYYY-MM-DD o cadena buida), dateText (data tal com està impresa, sense l’etiqueta, o cadena buida), dateSource ('issue', 'shipment', 'delivery' o cadena buida), rows (array), warnings (array de textos), notes (text breu). Cada row té units (nombre enter d’unitats del producte només si consta explícitament al document; null si no consta; no dedueixis les unitats a partir del pes, de g/pz ni de sacs o caixes; només unitats explícites del producte), name, category ('fish','other','service'), kg (número o null), price (preu unitari €/kg sense IVA, número o null), elab (cost total d'elaboració assignat a aquest peix, número, per defecte 0), uncertain (booleà). Per a date, si només hi ha una data llegible al document, fes-la servir com a data de compra encara que no tingui etiqueta o no sigui a la capçalera. Si n’hi ha diverses, prioritza la data de l’albarà o la d’enviament o lliurament i evita les dates de lot i caducitat. Busca el camp DATA o FECHA, sovint al costat del número d’albarà i just sobre la taula de productes. Si hi ha un retall ampliat, usa’l per llegir aquest camp. Copia els dígits i les barres exactament a dateText, sense canviar-ne l’ordre ni ampliar l’any. En DD/MM/AA o DD/MM/AAAA el primer grup és el dia, el segon és el mes i l’últim és l’any. Per exemple, 07/03/25 correspon a 2025-03-07. Usa aquest ordre per obtenir date. dateSource pot quedar buit si no hi ha etiqueta. Deixa date i dateText buits només si no pots llegir ni identificar la data. No confonguis 4,860 kg amb 4860 kg; coma decimal. Distingeix els totals de factura dels serveis d'elaboració. No dupliquis línies. Per associar l'elaboració, compara PRIORITÀRIAMENT els kg de la línia de servei amb els kg de cada peix: 11,500 kg d'elaboració correspon a un peix de 11,500 kg, NO a un de 4,860 kg. Només assigna el cost quan coincideixen clarament el pes i el context; en cas contrari retorna una fila service i avisa. No assignis elaboració basant-te només en proximitat visual. Per als peixos i cefalòpodes, el camp name ha de contenir NOMÉS el nom comú de l'espècie en CATALÀ, sense mides, calibres, pesos, zones de pesca, ni adjectius comercials. Tradueix noms en castellà (dorada→Orada, lubina→Llobarro, merluza→Lluç, rodaballo→Rèmol, rape→Rap). Si no estàs segur de la traducció, indica uncertain i avisa; no inventis una espècie. Classifica peixos i cefalòpodes amb category fish, inclosos pop (pulpo), sèpia (sepia, choco), calamar, calamarset (chipirón) i pota. Classifica la resta de productes amb category other i conserva’n la descripció impresa. Si només hi ha preu per unitat, deixa price a null. No inventis dades absents, marca uncertain i avisa de qualsevol inconsistència aritmètica. Els costos són sense IVA.`;
 const content=[
  {type:'input_text',text:'Extreu les dades d’aquest albarà en JSON a partir del document complet.'},
  isPdf?{type:'input_file',filename:'albara.pdf',file_data:`data:application/pdf;base64,${image}`}:
   {type:'input_image',image_url:`data:${mimeType};base64,${image}`,detail:'high'}
 ];
 if(!isPdf&&typeof headerImage==='string'&&headerImage.length<=500000&&/^[A-Za-z0-9+/]+={0,2}$/.test(headerImage)){
  content.push({type:'input_text',text:'Retall ampliat de la mateixa fotografia per transcriure la data impresa.'},
   {type:'input_image',image_url:`data:image/jpeg;base64,${headerImage}`,detail:'high'});
 }
 try {
  const resp=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini',input:[{role:'system',content:instructions},{role:'user',content}],text:{format:{type:'json_object'}},max_output_tokens:6500})});
  if(!resp.ok) { console.error('OpenAI status',resp.status); return json({error:'El servei d’IA ha retornat un error. Comprova el saldo i la clau.'},502); }
  const data=await resp.json(); const output=(data.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
  const parsed=JSON.parse(output); if(!Array.isArray(parsed.rows)) throw Error('Resposta incompleta');
  // Classificació determinista per a espècies conegudes: no dependre només del model.
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const names=['lluerna','luerna','orada','dorada','lubina','llobarro','merluza','lluc','rape','rap','rodaballo','remol','besugo','besuc','corvina','corball','lenguado','llenguado','salmonete','moll','bacalao','bacalla','sargo','sarg','denton','dentol','caballa','verat','jurel','sorell','pop','pops','pulpo','pulpos','sepia','sepias','sipia','choco','calamar','calamars','calamares','calamarset','chipiron','chipirones','pota'];
  for(const r of parsed.rows){
   const name=normalize(r.name).trim();
   if(r.category==='other'&&names.some(n=>name===n||name.startsWith(n+' ')||name.startsWith(n+'-')))r.category='fish';
  }
  // Una línia de servei amb el mateix pes no és un altre peix.
  // Evitem sumar-la si la IA ja ha imputat aquest import a la partida.
  for(const svc of parsed.rows.filter(r=>r.category==='service')){
   const amount=Number(svc.elab)||Number(svc.total)||0;
   if(!(amount>0)||!(Number(svc.kg)>0))continue;
   const candidates=parsed.rows.filter(r=>r.category==='fish'&&Number(r.kg)>0&&Math.abs(Number(r.kg)-Number(svc.kg))<0.011);
   if(candidates.length===1){
    for(const other of parsed.rows.filter(r=>r.category==='fish'&&r!==candidates[0])){if(Math.abs(Number(other.elab||0)-amount)<0.011)other.elab=0;}
    const f=candidates[0];
    if(!(Number(f.elab)>0))f.elab=amount;
    svc.elab=0;
   }
  }
  const finite=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
  return json({supplier:typeof parsed.supplier==='string'?parsed.supplier.slice(0,120):'',invoiceNumber:typeof parsed.invoiceNumber==='string'?parsed.invoiceNumber.slice(0,100):'',date:typeof parsed.date==='string'?parsed.date:'',dateText:typeof parsed.dateText==='string'?parsed.dateText.slice(0,24):'',dateSource:['issue','shipment','delivery'].includes(parsed.dateSource)?parsed.dateSource:'',rows:parsed.rows.slice(0,60).map(r=>({name:String(r.name||'').slice(0,150),category:['fish','other','service'].includes(r.category)?r.category:'other',kg:finite(r.kg),price:finite(r.price),elab:finite(r.elab)??0,units:Number.isInteger(r.units)&&r.units>0&&r.units<=500?r.units:null,uncertain:!!r.uncertain})),warnings:Array.isArray(parsed.warnings)?parsed.warnings.slice(0,20):[],notes:String(parsed.notes||'').slice(0,3000)});
 } catch(e) { console.error('Anàlisi fallida',e); return json({error:'No s’ha pogut completar l’anàlisi.'},502); }
}};
