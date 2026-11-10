'use strict';
// Leitor de ZIP e associador de imagens por SKU.
// Sem dependências: usa DecompressionStream (navegadores modernos e Node 18+).
// Carregado como <script> clássico no painel e importável nos testes Node.
(() => {
  const IMAGE_EXT=/\.(jpe?g|png|webp)$/i;
  const EOCD_SIG=0x06054b50,CDH_SIG=0x02014b50,LFH_SIG=0x04034b50;
  const limits={maxEntries:5000,maxFileBytes:3*1024*1024,maxTotalBytes:400*1024*1024,maxZipBytes:350*1024*1024,maxRatio:500,maxPerSku:13,maxDepth:6};
  const decoder=new TextDecoder();
  const u16=(view,offset)=>view.getUint16(offset,true);
  const u32=(view,offset)=>view.getUint32(offset,true);

  const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}return table;})();
  function crc32(bytes){let crc=0xffffffff;for(let i=0;i<bytes.length;i++)crc=crcTable[(crc^bytes[i])&0xff]^(crc>>>8);return (crc^0xffffffff)>>>0;}

  function validateName(name) {
    if(!name||name.length>512)throw new Error('Nome de arquivo inválido no ZIP.');
    if(name.includes('\\')||name.startsWith('/')||/^[a-zA-Z]:/.test(name))throw new Error(`Caminho inseguro no ZIP: ${name}`);
    const parts=name.split('/');
    if(parts.some(p=>p==='.'||p==='..'))throw new Error(`Caminho inseguro no ZIP: ${name}`);
    if(parts.length>limits.maxDepth)throw new Error(`Pastas profundas demais no ZIP: ${name}`);
  }
  function findEOCD(view,byteLength) {
    const stop=Math.max(0,byteLength-22-65535);
    for(let i=byteLength-22;i>=stop;i--) if(u32(view,i)===EOCD_SIG&&i+22+u16(view,i+20)===byteLength)return i;
    throw new Error('Não foi possível encontrar o índice do ZIP. O arquivo pode estar incompleto.');
  }
  // Valida a estrutura sem descompactar: nomes, limites, caminhos e taxas.
  // Retorna entradas de imagens e CSV prontas para extração, e a lista de arquivos ignorados.
  function listEntries(buffer) {
    if(!(buffer instanceof ArrayBuffer))throw new Error('ZIP inválido.');
    if(buffer.byteLength>limits.maxZipBytes)throw new Error('ZIP muito grande. O máximo é 350 MB.');
    const view=new DataView(buffer),byteLength=buffer.byteLength;
    const eocd=findEOCD(view,byteLength);
    const total=u16(view,eocd+10),cdSize=u32(view,eocd+12),cdOffset=u32(view,eocd+16);
    if(u16(view,eocd+4)!==0||u16(view,eocd+6)!==0)throw new Error('ZIP com múltiplos discos não é suportado.');
    if(total===0xffff||cdSize===0xffffffff||cdOffset===0xffffffff)throw new Error('ZIP64 não é suportado. Divida o arquivo em lotes menores.');
    if(cdOffset+cdSize>byteLength)throw new Error('ZIP corrompido.');
    const entries=[],csvEntries=[],ignored=[];const seen=new Set();
    let offset=cdOffset,totalBytes=0;
    for(let i=0;i<total;i++) {
      if(offset+46>byteLength||u32(view,offset)!==CDH_SIG)throw new Error('ZIP corrompido no diretório central.');
      const flags=u16(view,offset+8),method=u16(view,offset+10),crc=u32(view,offset+16);
      const compSize=u32(view,offset+20),uncompSize=u32(view,offset+24);
      const nameLen=u16(view,offset+28),extraLen=u16(view,offset+30),commentLen=u16(view,offset+32);
      const localOffset=u32(view,offset+42);
      if(offset+46+nameLen+extraLen+commentLen>byteLength)throw new Error('ZIP corrompido.');
      const name=decoder.decode(new Uint8Array(buffer,offset+46,nameLen));
      offset+=46+nameLen+extraLen+commentLen;
      validateName(name);
      if(name.endsWith('/'))continue;
      if(flags&0x1)throw new Error(`Arquivo protegido por senha não é suportado: ${name}`);
      if(method!==0&&method!==8)throw new Error(`Formato de compressão não suportado em ${name}.`);
      if(compSize===0||uncompSize===0)throw new Error(`${name} está vazio.`);
      if(IMAGE_EXT.test(name)) {
        if(uncompSize>limits.maxFileBytes)throw new Error(`${name} excede 3 MB. Reduza a imagem antes de importar.`);
        if(uncompSize/compSize>limits.maxRatio)throw new Error(`${name} tem taxa anormal de compressão (possível bomba de ZIP).`);
        if(seen.has(name))throw new Error(`Imagem duplicada no ZIP: ${name}`);
        seen.add(name);
        totalBytes+=uncompSize;
        if(totalBytes>limits.maxTotalBytes)throw new Error('As imagens somam mais de 400 MB. Divida em lotes menores.');
        entries.push({name,crc,method,compSize,uncompSize,localOffset});
      } else if(/\.csv$/i.test(name)) {
        if(uncompSize>2*1024*1024)throw new Error(`${name} excede 2 MB. Reduza o CSV antes de importar.`);
        if(uncompSize/compSize>limits.maxRatio)throw new Error(`${name} tem taxa anormal de compressão (possível bomba de ZIP).`);
        csvEntries.push({name,crc,method,compSize,uncompSize,localOffset});
      } else {
        ignored.push(name);
      }
    }
    if(entries.length+csvEntries.length+ignored.length>limits.maxEntries)throw new Error('ZIP com arquivos demais. O máximo é 5000.');
    if(!entries.length&&!csvEntries.length)throw new Error(ignored.length?'O ZIP não contém imagens JPEG, PNG ou WebP nem arquivos CSV.':'O ZIP está vazio.');
    return {entries,csvEntries,ignored};
  }
  async function extractEntry(buffer,entry) {
    const view=new DataView(buffer);
    if(u32(view,entry.localOffset)!==LFH_SIG)throw new Error(`ZIP corrompido em ${entry.name}.`);
    const nameLen=u16(view,entry.localOffset+26),extraLen=u16(view,entry.localOffset+28);
    const start=entry.localOffset+30+nameLen+extraLen,end=start+entry.compSize;
    if(end>buffer.byteLength)throw new Error(`ZIP corrompido em ${entry.name}.`);
    const localName=decoder.decode(new Uint8Array(buffer,entry.localOffset+30,nameLen));
    if(localName!==entry.name)throw new Error(`ZIP inconsistente em ${entry.name}.`);
    const raw=new Uint8Array(buffer,start,entry.compSize);
    let out;
    if(entry.method===0)out=raw;
    else {
      if(typeof DecompressionStream==='undefined')throw new Error('Este navegador não suporta descompressão de ZIP. Atualize o navegador.');
      const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      out=new Uint8Array(await new Response(stream).arrayBuffer());
    }
    if(out.length!==entry.uncompSize)throw new Error(`${entry.name}: tamanho inválido após descompressão.`);
    if(crc32(out)!==entry.crc)throw new Error(`${entry.name}: arquivo corrompido (CRC).`);
    return out;
  }
  function sniffType(bytes) {
    if(bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
    if(bytes.length>8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return 'image/png';
    if(bytes.length>12&&bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&bytes[8]===0x57&&bytes[9]===0x45&&bytes[10]===0x42&&bytes[11]===0x50)return 'image/webp';
    return null;
  }
  function base64Encode(bytes) {
    let binary='';const chunk=0x8000;
    for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,i+chunk));
    return btoa(binary);
  }
  // Associa imagens ao SKU: nome exato (capa) ou SKU + separador (galeria).
  // Ex.: CAD001.jpg, CAD001_1.png, CAD001-2.webp → SKU CAD001. CAD0011 não casa com CAD001.
  function matchImages(names,skus) {
    const bySku=new Map(),upper=new Map();
    for(const sku of skus) {const key=String(sku);bySku.set(key,[]);upper.set(key.toUpperCase(),key);}
    const unmatched=[],overflow=[];
    for(const name of names) {
      const base=name.split('/').pop().replace(IMAGE_EXT,'');
      const up=base.toUpperCase();
      let best=null;
      if(upper.has(up))best={sku:upper.get(up),exact:true,length:up.length};
      else for(const [skuUpper,sku] of upper) {
        if(up.length>skuUpper.length&&up.startsWith(skuUpper)&&/[^A-Z0-9]/.test(up[skuUpper.length]))
          if(!best||skuUpper.length>best.length)best={sku,exact:false,length:skuUpper.length};
      }
      if(!best) {unmatched.push(name);continue;}
      const list=bySku.get(best.sku);
      if(list.length>=limits.maxPerSku) {overflow.push(name);continue;}
      list.push({name,exact:best.exact});
    }
    const basename=name=>name.split('/').pop();
    for(const list of bySku.values())list.sort((a,b)=>(b.exact-a.exact)||basename(a.name).localeCompare(basename(b.name),'pt-BR',{numeric:true}));
    return {bySku,unmatched,overflow};
  }
  globalThis.BulkImport={IMAGE_EXT,limits,listEntries,extractEntry,sniffType,base64Encode,matchImages,crc32};
})();
