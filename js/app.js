const App=(()=>{
  const $=id=>document.getElementById(id),esc=StoreCore.escape,CART_KEY='mp_cart_v1';
  let products=[],categories=[],company={},banners=[],cart=[],ready=false,mode='all',category='todas',search='',refreshing=false,version='',sending=false,quoteItems=[],pending=null;
  const maxQuantity=()=>company.maxQuoteQuantity || 99;
  async function api(path,options={}){const response=await fetch(`/api/${path}`,{...options,cache:'no-store',headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});let data;try{data=await response.json();}catch{throw new Error('Não foi possível comunicar com a loja.');}if(!response.ok)throw new Error(data.error || 'Serviço indisponível.');return data;}
  let sessionKey;try{sessionKey=sessionStorage.getItem('mp_metrics_session');if(!/^[a-f0-9-]{36}$/i.test(sessionKey||'')){sessionKey=crypto.randomUUID();sessionStorage.setItem('mp_metrics_session',sessionKey);}}catch{sessionKey=crypto.randomUUID();}
  function event(name,productId,origin='storefront',productIds){const payload={name,productId,productIds,origin,sessionKey,eventKey:crypto.randomUUID()};api('events',{method:'POST',body:JSON.stringify(payload)}).catch(()=>{});}
  function loadCart(){try{return StoreCore.normalizeCart(JSON.parse(localStorage.getItem(CART_KEY)||'[]'),products,maxQuantity());}catch{return [];}}
  function saveCart(persist=true){
    cart=StoreCore.normalizeCart(cart,products,maxQuantity());
    if(persist)try{localStorage.setItem(CART_KEY,JSON.stringify(cart));$('cartStorageStatus').hidden=true;}catch{$('cartStorageStatus').hidden=false;}
    UI.updateBadge(cart.reduce((n,i)=>n+i.qty,0));UI.renderCart(cart.map(i=>({...i,product:products.find(p=>p.id===i.id)})));
    $('checkoutBtn').disabled=!ready||!cart.length||sending||cart.some(i=>!products.find(p=>p.id===i.id)?.available);
  }
  function productCards(list){return list.map(p=>{
    const image=StorefrontPolicy.productImage(p.image),href=ProductPage.url(p),measured=['m','m2','m3'].includes(p.unit);
    return `<article class="product" data-id="${p.id}"><a class="product__media" href="${href}" aria-label="Ver ${esc(p.name)}">${image?`<img class="product__img" src="${esc(image)}" alt="${esc(p.name)}" width="480" height="480"${UI.responsive(image)} decoding="async" loading="lazy">`:UI.photoPlaceholder()}${!p.available?'<span class="product__badge unavailable">Indisponível</span>':p.offer?'<span class="product__badge offer">Condição especial</span>':p.featured?'<span class="product__badge">Seleção Progresso</span>':''}</a><div class="product__body"><span class="product__category">${esc(p.categoryLabel)}</span><h3 class="product__name"><a href="${href}">${esc(p.name)}</a></h3><p class="product__dimensions">${esc(p.shortDescription||StoreCore.dimensions(p))}</p><div class="product__price-row">${p.offer?`<s class="product__price-old">${UI.formatPrice(p.oldPrice)}</s>`:''}<span class="product__price">${UI.formatPrice(p.price)}</span><span class="product__unit">/ ${esc(StoreCore.unitLabel(p.unit))}</span></div>${p.price!==null&&!company.confirmed?'<small class="price-disclaimer">Valor de referência</small>':''}<a class="product__btn" href="${href}">${measured?'Calcular metragem':'Conhecer produto'} ${UI.icon('arrow')}</a></div></article>`;
  }).join('');}
  function renderProducts(){
    const filtered=products.filter(p=>(category==='todas'||p.category===category)&&(mode!=='promotions'||p.offer)&&StoreCore.matches(p,search));
    $('productsGrid').innerHTML=productCards(filtered);$('emptyState').hidden=!ready||!!filtered.length;$('productCount').textContent=`${filtered.length} produto(s)`;
    $('catalogTitle').textContent=mode==='promotions'?'Produtos em promoção':search?'Resultados da busca':category==='todas'?'Produtos em destaque':categories.find(c=>c.id===category)?.label||'Produtos';$('searchSummary').textContent=search?`Resultados para “${search}”.`:'Confira as medidas e adicione os produtos à sua lista.';$('searchSummary').classList.toggle('is-search',!!search);$('promotionFilter').setAttribute('aria-pressed',String(mode==='promotions'));
    const featured=products.filter(p=>p.featured);$('destaques').hidden=!featured.length;$('featuredGrid').innerHTML=productCards(featured);UI.images($('productsGrid'));UI.images($('featuredGrid'));
    $('featuredNav').hidden=!featured.length;
    const promotions=products.some(p=>p.offer);$('promotionFilter').hidden=!promotions;
    document.querySelectorAll('[data-mode="promotions"]').forEach(link=>link.hidden=!promotions);
    renderCategories();
  }
  function renderCategories(){
    const visible=categories.filter(c=>products.some(p=>p.category===c.id));
    $('categoryTiles').innerHTML=[{id:'todas',label:'Todos os materiais'},...visible].map(c=>{
      const image=StorefrontPolicy.productImage(c.image)||StorefrontPolicy.productImage(products.find(p=>p.category===c.id&&StorefrontPolicy.productImage(p.image))?.image);
      return `<button class="category-tile${c.id===category?' is-active':''}" data-cat="${esc(c.id)}" aria-pressed="${c.id===category}"><span class="category-picture">${image?`<img src="${esc(image)}" alt="" width="120" height="120" loading="lazy">`:UI.icon(c.id==='todas'?'grid':'list')}</span><strong>${esc(c.label)}</strong><span>${c.id==='todas'?products.length:products.filter(p=>p.category===c.id).length} produtos</span></button>`;
    }).join('');
    let nav=$('categoryNav');if(!nav){nav=document.createElement('nav');nav.id='categoryNav';nav.className='category-nav container';nav.setAttribute('aria-label','Categorias de materiais');$('header').append(nav);}
    nav.innerHTML=`<a href="/#catalogo">Todos os materiais</a>`+visible.map(c=>ProductPage.id?`<a href="/?categoria=${encodeURIComponent(c.id)}#catalogo">${esc(c.label)}</a>`:`<button data-cat="${esc(c.id)}">${esc(c.label)}</button>`).join('')+'<a href="/#contato">Fale com a Progresso</a>';
  }
  function whatsappUrl(number,message){return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;}
  function renderCompany(){
    $('brandName').textContent=company.name.replace(/^Madeireira\s+/i,'');$('brandText').querySelector('small').textContent=/^Madeireira\s+/i.test(company.name)?'MADEIREIRA':'';$('footerName').textContent=company.name;$('copyrightName').textContent=company.name;document.title=`${company.name} · Materiais para sua obra`;
    for(const id of ['brandLogo','footerLogo']){const img=$(id);img.hidden=!company.logo;if(company.logo)img.src=StoreCore.image(company.logo);else img.removeAttribute('src');}$('brandText').hidden=!!company.logo;
    for(const [id,key]of [['companyPhone','phone'],['headerPhone','phone'],['companyAddress','address'],['companyHours','hours'],['companyRegion','region'],['deliveryTerms','delivery'],['paymentTerms','payment'],['commercialTerms','commercialTerms'],['aboutTitle','aboutTitle'],['aboutText','aboutText'],['footerText','footerText']])$(id).textContent=company[key]||'';
    const steps=[{title:'Escolha os produtos',text:'Compare medidas e unidades.'},{title:'Monte sua lista',text:'Inclua cortes e quantidades.'},{title:'Peça seu orçamento',text:'A equipe confirma as condições.'}];
    const configured=company.benefits||[],seedBenefits=configured.length===2&&configured[0].title==='Atendimento próximo'&&configured[0].text==='Converse com nossa equipe.'&&configured[1].title==='Orçamento personalizado'&&configured[1].text==='Informe suas medidas e necessidades.';
    const benefits=company.confirmed&&configured.length&&!seedBenefits?configured:steps;
    $('benefits').innerHTML=benefits.map((b,i)=>`<div class="benefit"><span class="benefit-symbol" aria-hidden="true">${UI.icon(['check','list','message'][i%3])}</span><div><strong>${esc(b.title)}</strong><p>${esc(b.text)}</p></div></div>`).join('');
    for(const id of ['headerWhats','waFloat','contactWhats']){const link=$(id);link.href=company.canWhatsapp?whatsappUrl(company.whatsapp,company.whatsappMessage):'#catalogo';link.removeAttribute('aria-disabled');if(company.canWhatsapp){link.target='_blank';link.rel='noopener';}else{link.removeAttribute('target');link.removeAttribute('rel');}}
    $('headerWhatsLabel').textContent=company.canWhatsapp?'WhatsApp':'Solicitar orçamento';$('contactWhats').textContent=company.canWhatsapp?'Falar com a equipe':'Escolher produtos';$('waFloat').hidden=!company.canWhatsapp;
    $('headerPhone').textContent=company.confirmed?company.phone:'Dados em atualização';
    UI.images($('header'));UI.images(document.querySelector('.footer'));
  }
  function renderHero(){
    const image=StoreCore.image(company.heroImage),illustrative=image==='assets/hero-madeira.webp';
    $('heroTrack').innerHTML=`<article class="hero-slide"><div class="hero-copy"><h1 id="heroTitle">${esc(company.heroTitle)}</h1></div><figure class="hero-figure">${image?`<img class="hero-photo" src="${esc(image)}" ${UI.responsive(image,'(max-width: 760px) 100vw, 100vw')} width="1942" height="809" fetchpriority="high" alt="${illustrative?'Tábuas empilhadas, fotografia ilustrativa':'Imagem institucional fornecida pela loja'}">`:UI.photoPlaceholder()}<figcaption>${illustrative?'Fotografia ilustrativa. Não retrata a loja.':image?'Imagem fornecida pela loja.':'Foto institucional ainda não disponível.'}</figcaption></figure></article>`;
    const campaigns=banners.filter(b=>!StorefrontPolicy.isSeedBanner(b));$('campaigns').hidden=!campaigns.length;
    $('campaigns').innerHTML=campaigns.map(b=>`<article class="campaign"><div><span class="eyebrow">${esc(b.tag||'NOVIDADES')}</span><h2>${esc(b.title)}</h2><p>${esc(b.body)}</p><a class="text-link" href="${esc(b.destination||'#catalogo')}">${esc(b.cta||'Ver produtos')} ${UI.icon('arrow')}</a></div>${b.image?`<img src="${esc(StoreCore.image(b.image))}" alt="Imagem da campanha ${esc(b.title)}" loading="lazy">`:''}</article>`).join('');
    const title=$('heroTitle');
    if(['Portas, tábuas e madeira para sua obra.','A madeira certa para cada projeto.'].includes(company.heroTitle)){
      title.replaceChildren(document.createTextNode('Madeira de verdade '));
      const line=document.createElement('span');line.textContent='para grandes projetos';title.append(line);
    }
    const callout=document.createElement('div');callout.className='hero-quote';
    const defaultText=['Portas, tábuas, ripas e estruturas. Encontre o que precisa e converse com nossa equipe.','Escolha os materiais e envie sua lista com as medidas para pedir um orçamento.'];
    callout.innerHTML=`<p>${esc(defaultText.includes(company.heroText)?'Soluções completas em madeiras e materiais para construção.':company.heroText)}</p><a class="btn primary" href="#catalogo">Ver produtos</a>`;
    $('heroTrack').querySelector('.hero-slide').append(callout);
    UI.images($('heroTrack'));UI.images($('campaigns'));
  }
  function applyCatalog(data,initial=false){
    UI.media=data.media||[];products=data.products;categories=data.categories;company=StorefrontPolicy.company(data.settings);UI.confirmed=company.confirmed;banners=data.banners;version=JSON.stringify(data);ready=true;if(initial)cart=loadCart();if(category!=='todas'&&!categories.some(c=>c.id===category))category='todas';
    renderCompany();renderHero();renderCategories();renderProducts();saveCart(false);$('catalogStatus').textContent='';ProductPage.render(products,company);
  }
  async function load(){ready=false;$('catalogStatus').textContent='Carregando catálogo…';$('retryCatalog').hidden=true;$('productsGrid').setAttribute('aria-busy','true');try{const data=await api('catalog');applyCatalog(data,true);event('catalog_view');}catch{ready=false;$('productsGrid').replaceChildren();$('emptyState').hidden=true;$('catalogStatus').textContent='Catálogo indisponível no momento. Tente novamente em instantes.';$('retryCatalog').hidden=false;$('checkoutBtn').disabled=true;}finally{$('productsGrid').setAttribute('aria-busy','false');}}
  async function refresh(){if(!ready||refreshing||document.visibilityState==='hidden'||document.querySelector('dialog[open],.modal.is-open,.drawer.is-open')||document.activeElement.closest('.product,.cart-item'))return;refreshing=true;try{const data=await api('catalog');if(JSON.stringify(data)!==version)applyCatalog(data);}catch{$('catalogStatus').textContent='Não foi possível atualizar os produtos agora. Vamos conferir os itens quando você enviar a solicitação.';}finally{refreshing=false;}}
  function validItem(p,qty){if(!p?.available){UI.toast('Produto indisponível.');return false;}if(!StoreCore.validQuantity(qty,p.unit,maxQuantity())){UI.toast(`Informe uma quantidade válida. ${['m','m2','m3'].includes(p.unit)?'Use até três casas decimais.':'Use quantidade inteira.'}`);return false;}return true;}
  function addToCart(id,qty=1,details={}){
    const p=products.find(p=>p.id===id);if(!ready||!validItem(p,qty))return false;const total=cart.filter(i=>i.id===id).reduce((n,i)=>n+i.qty,0)+qty;
    if(p.stock!==null&&total>p.stock+0.0000001){UI.toast('Quantidade maior que o estoque disponível.');return false;}
    const measures=String(details.measures||'').slice(0,500),specifications=String(details.specifications||'').slice(0,1000),existing=details.measurement?null:cart.find(i=>!i.measurement&&i.id===id&&(i.measures||'')===measures&&(i.specifications||'')===specifications);
    if(existing){if(existing.qty+qty>maxQuantity()){UI.toast('Quantidade acima do limite por item.');return false;}existing.qty=Math.round((existing.qty+qty)*1000)/1000;}
    else cart.push({id,qty,lineKey:crypto.randomUUID(),measures,specifications,...details.measurement?{measurement:details.measurement}:{}});saveCart();return true;
  }
  function cartItem(key){return cart.find(i=>(i.lineKey||`p${i.id}`)===String(key)||i.id===key);}
  function setQuantity(key,qty){const item=cartItem(key);if(!item||item.measurement)return;const p=products.find(p=>p.id===item.id);if(!validItem(p,qty)){saveCart(false);return;}const aggregate=cart.filter(i=>i.id===item.id&&i!==item).reduce((n,i)=>n+i.qty,0)+qty;if(p.stock!==null&&aggregate>p.stock+0.0000001){UI.toast('Quantidade maior que o estoque disponível.');saveCart(false);return;}item.qty=Math.round(qty*1000)/1000;saveCart();}
  function incCart(key){const item=cartItem(key);if(item)setQuantity(key,Math.round((item.qty+1)*1000)/1000);}
  function decCart(key){const item=cartItem(key);if(item){const p=products.find(p=>p.id===item.id);setQuantity(key,Math.max(StoreCore.step(p.unit),Math.round((item.qty-1)*1000)/1000));}}
  function removeFromCart(key){const item=cartItem(key);cart=cart.filter(i=>i!==item);saveCart();}
  function openRequest(items){if(!ready||!items.length)return;quoteItems=items.map(i=>({...i}));UI.closeProductModal();UI.closeDrawer();$('quoteFields').hidden=false;$('quoteSuccess').hidden=true;$('quoteError').textContent='';$('quoteDialog').showModal();}
  function requestProduct(id,qty=1,details={}){const p=products.find(p=>p.id===id);if(!validItem(p,qty))return;if(p.stock!==null&&qty>p.stock){UI.toast('Quantidade maior que o estoque disponível.');return;}openRequest([{id,qty,lineKey:`p${id}`,measures:details.measures||'',specifications:details.specifications||'',...details.measurement?{measurement:details.measurement}:{}}]);}
  async function submitQuote(e){
    e.preventDefault();if(sending)return;const form=e.currentTarget;
    const payload={items:quoteItems,customer:{name:form.elements.name.value.trim(),phone:form.elements.phone.value,email:form.elements.email.value.trim()},fulfillment:form.elements.fulfillment.value,deliveryAddress:form.elements.deliveryAddress.value.trim(),notes:form.elements.notes.value.trim()};
    sending=true;$('quoteSubmit').disabled=true;$('quoteError').textContent='';
    // Reserve the tab during the click so browsers can open WhatsApp after the API responds.
    let whatsappTab=null;
    if(company.canWhatsapp)try{whatsappTab=window.open('about:blank','_blank');if(whatsappTab)whatsappTab.opener=null;}catch{}
    try{
      const bytes=new TextEncoder().encode(JSON.stringify(payload));const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if(!pending)try{pending=JSON.parse(sessionStorage.getItem('mp_quote_request_v1')||'null');}catch{}
      if(!pending||pending.hash!==hash||typeof pending.key!=='string')pending={hash,key:crypto.randomUUID()};try{sessionStorage.setItem('mp_quote_request_v1',JSON.stringify(pending));}catch{}
      const result=await api('quotes',{method:'POST',body:JSON.stringify({...payload,requestKey:pending.key})});
      $('quoteFields').hidden=true;$('quoteSuccess').hidden=false;$('quoteProtocol').textContent=result.protocol;$('quoteWhats').hidden=!company.canWhatsapp||!StoreCore.validWhatsapp(result.whatsapp);if(!$('quoteWhats').hidden)$('quoteWhats').href=whatsappUrl(result.whatsapp,result.message);
      $('quoteWhats').onclick=()=>event('whatsapp_click',undefined,'quote_continue',[...new Set(quoteItems.map(i=>i.id))]);$('quoteProtocol').focus();
      $('quoteWhatsappStatus').textContent=$('quoteWhats').hidden?'Sua solicitação está registrada para atendimento pela equipe.':'A mensagem contém todos os itens da sua lista. Confirme o envio no WhatsApp. Se a conversa não abrir, use o botão abaixo.';
      // Very long URLs may be rejected by browsers/apps. Keep the full report available for copying.
      let fullMessage=$('quoteFullMessage');
      if(!fullMessage){
        fullMessage=document.createElement('div');fullMessage.id='quoteFullMessage';
        const label=document.createElement('label');label.textContent='Lista completa para copiar e enviar';
        const report=document.createElement('textarea');report.readOnly=true;report.rows=8;label.append(report);
        const copy=document.createElement('button');copy.type='button';copy.className='btn ghost block';copy.textContent='Copiar lista completa';
        copy.onclick=async()=>{try{await navigator.clipboard.writeText(report.value);UI.toast('Lista copiada. Cole na conversa do WhatsApp.');}catch{report.focus();report.select();UI.toast('Selecione e copie a lista para colar no WhatsApp.');}};
        fullMessage.append(label,copy);$('quoteDone').before(fullMessage);
      }
      const longMessage=!$('quoteWhats').hidden&&$('quoteWhats').href.length>16000;
      fullMessage.hidden=!longMessage;fullMessage.querySelector('textarea').value=result.message;
      if(longMessage){
        $('quoteWhats').href=`https://wa.me/${result.whatsapp}`;
        $('quoteWhatsappStatus').textContent='Sua lista é extensa. Copie a lista completa abaixo, abra o WhatsApp e cole na conversa para confirmar o envio. O protocolo e todos os itens estão preservados.';
      }
      if(!$('quoteWhats').hidden&&whatsappTab&&!whatsappTab.closed){
        try{
          const conversation=whatsappTab;
          whatsappTab.location.replace($('quoteWhats').href);whatsappTab=null;$('quoteWhats').onclick();
          const restoreFocus=()=>{
            if(document.hidden)return;
            window.removeEventListener('focus',restoreFocus);document.removeEventListener('visibilitychange',restoreFocus);
            requestAnimationFrame(()=>{if($('quoteDialog').open&&!$('quoteSuccess').hidden)$('quoteProtocol').focus();});
          };
          window.addEventListener('focus',restoreFocus);document.addEventListener('visibilitychange',restoreFocus);
          const returnTimer=setInterval(()=>{
            if(!$('quoteDialog').open){clearInterval(returnTimer);window.removeEventListener('focus',restoreFocus);document.removeEventListener('visibilitychange',restoreFocus);return;}
            if(conversation.closed&&!document.hidden&&document.hasFocus()){clearInterval(returnTimer);restoreFocus();}
          },250);
        }catch{}
      }
    }catch(error){$('quoteError').textContent=error.message;}finally{if(whatsappTab&&!whatsappTab.closed)whatsappTab.close();sending=false;$('quoteSubmit').disabled=false;saveCart(false);}
  }
  function catalogMode(next){mode=next;$('promotionFilter').setAttribute('aria-pressed',String(mode==='promotions'));renderProducts();}
  function init(){
    UI.icons();$('year').textContent=new Date().getFullYear();$('retryCatalog').onclick=load;$('cartToggle').onclick=()=>UI.openDrawer();$('cartClose').onclick=()=>UI.closeDrawer();$('overlay').onclick=()=>UI.closeDrawer();
    $('clearCart').onclick=()=>{if(cart.length&&confirm('Limpar todos os itens do orçamento?')){cart=[];saveCart();UI.toast('Orçamento limpo.');}};$('checkoutBtn').onclick=()=>openRequest(cart);
    $('clearFilters').onclick=()=>{category='todas';search='';mode='all';$('searchInput').value='';renderProducts();};$('promotionFilter').onclick=()=>catalogMode(mode==='promotions'?'all':'promotions');
    $('searchInput').oninput=e=>{search=e.target.value;if(!ProductPage.id)renderProducts();};$('searchForm').onsubmit=e=>{e.preventDefault();search=$('searchInput').value;if(ProductPage.id){location.assign('/?busca='+encodeURIComponent(search)+'#catalogo');return;}renderProducts();$('catalogo').scrollIntoView({behavior:'auto'});};
    document.body.addEventListener('click',e=>{
      const modeLink=e.target.closest('[data-mode]');if(modeLink)catalogMode(modeLink.dataset.mode);
      else if(e.target.closest('a')?.getAttribute('href')==='#promocoes')catalogMode('promotions');
      const cat=e.target.closest('[data-cat]');if(cat){category=cat.dataset.cat;renderProducts();const replacement=$('categoryTiles').querySelector(`[data-cat="${category}"]`);replacement?.focus({preventScroll:true});return;}
      if(e.target.closest('[data-open-cart]')){UI.openDrawer();return;}
      const add=e.target.closest('[data-add]'),details=e.target.closest('[data-details]');
      if(add&&!add.disabled){const p=products.find(p=>p.id===Number(add.dataset.add));if(p&&['m','m2','m3'].includes(p.unit)){location.assign(ProductPage.url(p));return;}if(addToCart(Number(add.dataset.add)))UI.toast('Produto adicionado ao orçamento.');return;}
      if(details){const p=products.find(p=>p.id===Number(details.dataset.details));if(p){location.assign(ProductPage.url(p));}return;}
    });
    $('cartItems').onclick=e=>{const up=e.target.closest('[data-qty-inc]'),down=e.target.closest('[data-qty-dec]'),remove=e.target.closest('[data-remove]');if(up)incCart(up.dataset.qtyInc);if(down)decCart(down.dataset.qtyDec);if(remove)removeFromCart(remove.dataset.remove);};
    $('cartItems').onchange=e=>{if(e.target.matches('[data-qty]'))return setQuantity(e.target.dataset.qty,Number(e.target.value));const item=cartItem(e.target.dataset.measures || e.target.dataset.specifications);if(!item)return;if(e.target.matches('[data-measures]'))item.measures=e.target.value.slice(0,500);if(e.target.matches('[data-specifications]'))item.specifications=e.target.value.slice(0,1000);saveCart();};
    $('productModal').onclick=e=>{if(e.target===$('productModal'))UI.closeProductModal();};$('quoteClose').onclick=$('quoteDone').onclick=()=>$('quoteDialog').close();$('quoteForm').onsubmit=submitQuote;
    $('quoteForm').elements.fulfillment.onchange=e=>{const delivery=e.target.value==='delivery';$('deliveryAddressLabel').hidden=!delivery;$('quoteForm').elements.deliveryAddress.required=delivery;};
    for(const id of ['headerWhats','waFloat','contactWhats'])$(id).onclick=()=>{if(company.canWhatsapp)event('whatsapp_click',undefined,{headerWhats:'header',waFloat:'floating',contactWhats:'contact'}[id]);};
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){UI.closeProductModal();UI.closeDrawer();}if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();$('searchInput').focus();}});
    window.addEventListener('storage',e=>{if(e.key===CART_KEY&&ready){cart=loadCart();saveCart(false);}});window.addEventListener('focus',refresh);setInterval(refresh,30000);if(location.hash==='#promocoes')mode='promotions';search=new URLSearchParams(location.search).get('busca')||'';category=new URLSearchParams(location.search).get('categoria')||'todas';$('searchInput').value=search;load().then(()=>{if(ProductPage.id&&ready)event('product_view',ProductPage.id,'product_page');});
  }
  document.addEventListener('DOMContentLoaded',init);return {addToCart,incCart,decCart,removeFromCart,requestProduct,maxQuantity};
})();
