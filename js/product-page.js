const ProductPage=(()=>{
  const esc=StoreCore.escape,$=id=>document.getElementById(id);
  const match=location.pathname.match(/^\/produto\/(\d+)/),id=match?Number(match[1]):null;
  const url=p=>`/produto/${p.id}/${p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'madeira'}`;
  let mounted=false;
  function render(products,company){
    if(!id||mounted)return;
    mounted=true;
    document.body.classList.add('product-route');
    document.querySelector('.skip-link').href=location.pathname+'#productPage';
    for(const section of document.querySelectorAll('#main > section')) section.hidden=true;
    document.querySelectorAll('a[href^="#"]').forEach(a=>{if(!a.classList.contains('skip-link'))a.setAttribute('href','/'+a.getAttribute('href'));});
    const root=document.createElement('section');root.id='productPage';root.className='product-page container';$('main').prepend(root);
    const p=products.find(p=>p.id===id);
    if(!p){root.innerHTML='<h1>Produto não encontrado</h1><p>Este material não está disponível no catálogo.</p><a class="btn primary" href="/">Voltar para a loja</a>';return;}
    document.title=`${p.name} | ${company.name}`;
    document.querySelector('meta[name="description"]').content=(p.shortDescription||p.description||p.name).slice(0,160);
    const measured=['m','m2','m3'].includes(p.unit),photos=[...new Set([p.image,...p.images||[]])].map(StorefrontPolicy.productImage).filter(Boolean);
    root.innerHTML=`<nav class="breadcrumbs" aria-label="Localização"><a href="/">Início</a><span>/</span><a href="/#catalogo">${esc(p.categoryLabel)}</a><span>/</span><span>${esc(p.name)}</span></nav>
      <div class="pdp-grid"><div class="pdp-gallery"><div class="pdp-photo">${photos.length?`<img id="productPhoto" src="${esc(photos[0])}" alt="${esc(p.name)}" width="900" height="900" fetchpriority="high">`:UI.photoPlaceholder()}${p.offer?'<span class="pdp-badge">Condição especial</span>':''}</div><div class="pdp-thumbnails" aria-label="Fotos do produto">${photos.map((photo,i)=>`<button type="button" data-photo="${i}" aria-label="Ver foto ${i+1}" aria-pressed="${i===0}"><img src="${esc(photo)}" alt="Foto ${i+1} de ${esc(p.name)}" width="80" height="80"></button>`).join('')}</div></div>
      <div class="pdp-summary"><span class="eyebrow">${esc(p.categoryLabel)}</span><h1>${esc(p.name)}</h1><p class="pdp-reference">Referência ${esc(p.sku||p.reference)}</p><p class="pdp-intro">${esc(p.shortDescription||p.description.slice(0,300)||'Confira as medidas e as especificações deste material para sua obra.')}</p>
      <div class="pdp-price">${p.offer?`<s>${UI.formatPrice(p.oldPrice)}</s>`:''}<div><strong>${UI.formatPrice(p.price)}</strong><span> / ${esc(StoreCore.unitLabel(p.unit))}</span></div><small>${p.price==null?'Envie as medidas para receber uma cotação.':company.confirmed?'Preço por unidade de cobrança.':'Valor de referência, sujeito à confirmação.'}</small></div>
      <form id="productOrderForm"><div class="pdp-calculator"><div class="calculator-title"><span>${UI.icon(measured?'grid':'list')}</span><div><h2>${measured?'Calcule para sua obra':'Escolha a quantidade'}</h2><p>${measured?'Informe as medidas de cada peça em metros.':'Adicione o material ao seu orçamento.'}</p></div></div>
      ${measured?`<div class="measure-fields"><label>Comprimento (m)<input name="length" type="number" min="0.001" max="1000" step="0.001" value="${p.lengthMm?p.lengthMm/1000:1}" required inputmode="decimal"></label>${p.unit!=='m'?'<label>Largura (m)<input name="width" type="number" min="0.001" max="1000" step="0.001" value="1" required inputmode="decimal"></label>':''}${p.unit==='m3'?'<label>Espessura (m)<input name="thickness" type="number" min="0.001" max="1000" step="0.001" value="0.02" required inputmode="decimal"></label>':''}<label>Número de peças<input name="pieces" type="number" min="1" max="10000" step="1" value="1" required inputmode="numeric"></label></div><small class="measure-help">Ex.: 30 cm = 0,30 m · 2 cm = 0,02 m. A cobrança usa até três casas decimais, arredondando a metragem para cima.</small>`:`<label>Quantidade (${esc(StoreCore.unitLabel(p.unit))})<input name="quantity" type="number" min="1" max="${Math.min(p.stock??App.maxQuantity(),App.maxQuantity())}" step="1" value="1" required></label>`}
      <div class="pdp-estimate" aria-live="polite"><span id="measureFormula"></span><div><span>Total estimado</span><strong id="productTotal"></strong></div></div><p id="productCalcError" class="error" role="alert"></p></div>
      <label class="pdp-custom">Cortes e acabamento (opcional)<textarea name="specifications" maxlength="1000" rows="2" placeholder="Conte o que você precisa para a sua obra"></textarea></label>
      <button id="productAdd" class="btn primary block" type="submit"${p.available?'':' disabled'}>Adicionar ao orçamento ${UI.icon('plus')}</button><button id="productRequest" class="btn ghost block" type="button"${p.available?'':' disabled'}>Solicitar somente este produto</button>
      <p class="pdp-availability">${UI.icon(p.available?'check':'close')} ${p.available?'Disponível para orçamento':'Produto indisponível'}</p><p class="pdp-terms">${esc(p.commercialTerms)}</p></form>
      <div class="pdp-services"><span>${UI.icon('message')} Atendimento da nossa equipe</span><span>${UI.icon('home')} Retirada ou entrega sob consulta</span></div></div></div>
      <nav class="pdp-tabs" aria-label="Informações do produto"><a href="#productDescription">Sobre o produto</a><a href="#productSpecifications">Ficha técnica</a><a href="#productDelivery">Entrega e condições</a></nav>
      <div class="pdp-details"><section id="productDescription"><span class="eyebrow">CONHEÇA O MATERIAL</span><h2>Sobre o produto</h2><div class="long-description">${esc(p.description||'Consulte nossa equipe para mais informações sobre este material.')}</div></section><section id="productSpecifications"><h2>Ficha técnica</h2><dl>${Object.entries({'Código / SKU':p.sku,'Categoria':p.categoryLabel,'Unidade de venda':StoreCore.unitLabel(p.unit),'Dimensões':StoreCore.dimensions(p),'Comprimento':StoreCore.length(p),...p.specs||{}}).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section><section id="productDelivery"><h2>Entrega e condições</h2><p>${esc(company.delivery)}</p><p>${esc(company.payment)}</p><p>${esc(company.commercialTerms)}</p></section></div>
      <section class="pdp-related"><div class="section-head"><h2>Para completar sua obra</h2><a href="/#catalogo" class="text-link">Ver todos ${UI.icon('arrow')}</a></div><div class="related-grid">${products.filter(x=>x.id!==p.id&&x.category===p.category).slice(0,4).map(x=>`<a class="related-product" href="${url(x)}">${StorefrontPolicy.productImage(x.image)?`<img src="${esc(StorefrontPolicy.productImage(x.image))}" alt="${esc(x.name)}" loading="lazy" width="320" height="320">`:UI.photoPlaceholder()}<h3>${esc(x.name)}</h3><span>${UI.formatPrice(x.price)} / ${esc(StoreCore.unitLabel(x.unit))}</span></a>`).join('')||'<p>Explore os outros materiais do nosso catálogo.</p>'}</div></section>`;
    const form=$('productOrderForm');
    function calculation(){
      if(!measured)return {qty:Number(form.elements.quantity.value),details:{specifications:form.elements.specifications.value}};
      const input=Object.fromEntries(['length','width','thickness','pieces'].filter(k=>form.elements.namedItem(k)).map(k=>[k,Number(form.elements.namedItem(k).value)]));
      const result=WoodMeasure.calculate(p.unit,input);
      return {qty:result.qty,details:{measurement:result.dimensions,measures:result.formula,specifications:form.elements.specifications.value}};
    }
    function update(){try{const result=calculation();if(!StoreCore.validQuantity(result.qty,p.unit,App.maxQuantity()))throw new Error(`Limite de ${App.maxQuantity()} ${StoreCore.unitLabel(p.unit)} por item. Consulte a equipe para quantidades maiores.`);if(p.stock!==null&&result.qty>p.stock)throw new Error('Quantidade maior que o estoque disponível.');$('measureFormula').textContent=measured?result.details.measures:`${result.qty} ${StoreCore.unitLabel(p.unit)}`;$('productTotal').textContent=p.price===null?'Sob consulta':UI.amount(Math.round(p.price*100*result.qty)/100);$('productCalcError').textContent='';$('productAdd').disabled=$('productRequest').disabled=!p.available;return result;}catch(error){$('productCalcError').textContent=error.message;$('productTotal').textContent='—';$('measureFormula').textContent='Confira as medidas informadas.';$('productAdd').disabled=$('productRequest').disabled=true;return null;}}
    form.addEventListener('input',update);form.onsubmit=e=>{e.preventDefault();const result=update();if(result&&App.addToCart(p.id,result.qty,result.details)){UI.toast('Produto adicionado ao orçamento.');UI.openDrawer();}};
    $('productRequest').onclick=()=>{if(!form.reportValidity())return;const result=update();if(result)App.requestProduct(p.id,result.qty,result.details);};
    root.querySelectorAll('[data-photo]').forEach(button=>button.onclick=()=>{$('productPhoto').src=photos[Number(button.dataset.photo)];root.querySelectorAll('[data-photo]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
    // In-page links must stay on this product despite the shared base URL.
    root.querySelectorAll('.pdp-tabs a').forEach(a=>a.setAttribute('href',location.pathname+a.getAttribute('href')));
    UI.images(root);update();
  }
  return {id,url,render};
})();
