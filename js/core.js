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
    validQuantity(value,unit,max=99) { return typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=max&&Math.abs(value*1000-Math.round(value*1000))<0.000001&&(['m','m2','m3','kg'].includes(unit)||Number.isInteger(value)); },
    step(unit) {return ['m','m2','m3','kg'].includes(unit)?0.001:1;},
    unitLabel(unit) {return {un:'unidade',m:'metro',m2:'m²',m3:'m³',pacote:'pacote',kg:'quilograma'}[unit]||'unidade a confirmar';},
    dimensions(product) {return product.dimensions || Object.entries(product.specs||{}).filter(([k])=>/medida|largura|espessura|seção|área/i.test(k)).map(([k,v])=>`${k}: ${v}`).join(' · ') || 'Medidas sob consulta';},
    length(product) {return product.lengthMm==null?(product.specs?.Comprimento || 'Comprimento sob consulta'):`Comprimento: ${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(product.lengthMm/1000)} m`;},
    shoppingMessage(items,products,company) {
        const number=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(n);
        const money=cents=>cents===null?'Sob consulta':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
        let total=0,consultation=false;
        const quantities=new Map();
        const lines=items.map((item,index)=>{
            const p=products.find(p=>p.id===item.id);
            if(!p?.available||!this.validQuantity(item.qty,p.unit,company.maxQuoteQuantity||10000))throw Error('Produto ou quantidade indisponível. Revise sua lista.');
            quantities.set(p.id,(quantities.get(p.id)||0)+item.qty);
            if(p.stock!=null&&quantities.get(p.id)>p.stock+0.0000001)throw Error('Quantidade maior que o estoque disponível. Revise sua lista.');
            let measures=item.measures||'Conforme catálogo';
            if(item.measurement){const result=WoodMeasure.calculate(p.unit,item.measurement);if(result.qty!==item.qty)throw Error('As medidas mudaram. Refaça o cálculo.');measures=result.formula;}
            const cents=this.hasPrice(p.price)?Math.round(p.price*100):null;
            const subtotal=cents===null?null:Math.round(cents*item.qty);
            if(subtotal===null)consultation=true;else total+=subtotal;
            return `Item ${index+1}: ${p.name}\nSKU: ${p.sku||'Não informado'}\nReferência: ${p.reference||'Não informada'}\nMedidas/especificações: ${Object.entries(p.specs||{}).map(([k,v])=>`${k}: ${v}`).join('; ')}\nDimensões: ${this.dimensions(p)}\n${this.length(p)}\nMedidas solicitadas: ${measures}\nEspecificações solicitadas: ${item.specifications||'Conforme catálogo'}\nQuantidade: ${number(item.qty)} ${p.unit}\nPreço unitário estimado: ${money(cents)}\nSubtotal estimado do item: ${money(subtotal)}\nCondição comercial: ${p.commercialTerms||company.commercialTerms||'A confirmar com a equipe.'}`;
        });
        return `${company.whatsappMessage||'Olá! Gostaria de consultar esta lista.'}\n\nLISTA DE PRODUTOS (${items.length} itens)\n\n${lines.join('\n\n')}\n\n${consultation&&total===0?'Total: Sob consulta':`${consultation?'Subtotal dos itens com preço':'Total estimado'}: ${money(total)}`}${consultation?'\nHá itens sob consulta; total final a confirmar.':''}\n${company.commercialTerms||'Preços e disponibilidade sujeitos à confirmação.'}\nAguardando confirmação da equipe.`;
    },
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
