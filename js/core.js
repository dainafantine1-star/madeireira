globalThis.StoreCore = Object.freeze({
    hasPrice(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0; },
    escape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
    image(value) { return typeof value === 'string' && (/^https:\/\/[^\s]+$/i.test(value) || /^(?:images|assets|uploads)\/[a-z0-9/_.-]+$/i.test(value)) ? value : ''; },
    validWhatsapp(value) { return typeof value === 'string' && /^55[1-9]{2}9?[1-9][0-9]{7}$/.test(value); },
    normalizeSearch(value) { return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[×✕*]/g,'x').replace(/(\d),(?=\d)/g,'$1.').replace(/\s+/g,' ').trim(); },
    matches(product,query) {
        const normalize=this.normalizeSearch,term=normalize(query);if(!term)return true;
        const length=product.lengthMm==null?'':`${product.lengthMm}mm ${product.lengthMm/10}cm ${product.lengthMm/1000}m`;
        const corpus=normalize([product.name,product.sku,product.reference,product.categoryLabel,product.description,product.dimensions,length,...Object.entries(product.specs||{}).flat()].join(' ')).replace(/[\s-]+/g,'');
        const compact=term.replace(/[\s-]+/g,'');return corpus.includes(compact)||term.split(' ').every(t=>corpus.includes(t.replace(/-/g,'')));
    },
    validQuantity(value,unit,max=99) { return typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=max&&Math.abs(value*1000-Math.round(value*1000))<0.000001&&(['m','m2','m3'].includes(unit)||Number.isInteger(value)); },
    step(unit) {return ['m','m2','m3'].includes(unit)?0.001:1;},
    unitLabel(unit) {return {un:'unidade',m:'metro',m2:'m²',m3:'m³',pacote:'pacote'}[unit]||'unidade a confirmar';},
    dimensions(product) {return product.dimensions || Object.entries(product.specs||{}).filter(([k])=>/medida|largura|espessura|seção|área/i.test(k)).map(([k,v])=>`${k}: ${v}`).join(' · ') || 'Medidas sob consulta';},
    length(product) {return product.lengthMm==null?(product.specs?.Comprimento || 'Comprimento sob consulta'):`Comprimento: ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(product.lengthMm/1000)} m`;},
    normalizeCart(input, products,max=99) {
        if (!Array.isArray(input)) return [];
        const valid = new Map(products.map(p => [p.id,p])), items = new Map();
        for (const item of input.slice(0,1000)) {
            if (!item || !Number.isSafeInteger(item.id) || !valid.has(item.id) || !this.validQuantity(item.qty,valid.get(item.id).unit,max)) continue;
            if(item.lineKey!==undefined&&(typeof item.lineKey!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(item.lineKey)))continue;
            if(item.measures!==undefined&&(typeof item.measures!=='string'||item.measures.length>500))continue;
            if(item.specifications!==undefined&&(typeof item.specifications!=='string'||item.specifications.length>1000))continue;
            const key=item.lineKey || `p${item.id}`,old=items.get(key);if(old&&old.id!==item.id)continue;
            const result={id:item.id,qty:Math.round(Math.min(max,(old?.qty || 0)+item.qty)*1000)/1000};
            if(item.lineKey!==undefined)result.lineKey=item.lineKey;if(item.measures!==undefined)result.measures=item.measures;if(item.specifications!==undefined)result.specifications=item.specifications;
            if(item.measurement){try{const calculated=WoodMeasure.calculate(valid.get(item.id).unit,item.measurement);if(calculated.qty!==result.qty)continue;result.measurement=calculated.dimensions;result.measures=calculated.formula;}catch{continue;}}
            items.set(key,result);
        }
        return [...items.values()];
    }
});
