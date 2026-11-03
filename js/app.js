const App=(()=>{
  const $=id=>document.getElementById(id),esc=StoreCore.escape,CART_KEY='mp_cart_v1';
  let products=[],categories=[],company={},banners=[],cart=[],ready=false,mode='all',category='todas',search='',refreshing=false,version='';
  const maxQuantity=()=>company.maxQuoteQuantity || 99;
  async function api(path,options={}){const response=await fetch(`/api/${path}`,{...options,cache:'no-store',headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});let data;try{data=await response.json();}catch{throw new Error('Não foi possível comunicar com a loja.');}if(!response.ok)throw new Error(data.error || 'Serviço indisponível.');return data;}
  let sessionKey;try{sessionKey=sessionStorage.getItem('mp_metrics_session');if(!/^[a-f0-9-]{36}$/i.test(sessionKey||'')){sessionKey=crypto.randomUUID();sessionStorage.setItem('mp_metrics_session',sessionKey);}}catch{sessionKey=crypto.randomUUID();}
  function event(name,productId,origin='storefront',productIds){const payload={name,productId,productIds,origin,sessionKey,eventKey:crypto.randomUUID()};api('events',{method:'POST',body:JSON.stringify(payload)}).catch(()=>{});}
  function loadCart(){try{return StoreCore.normalizeCart(JSON.parse(localStorage.getItem(CART_KEY)||'[]'),products,maxQuantity());}catch{return [];}}
  let renderingCart=false;
  function saveCart(persist=true){
    if(renderingCart)return;
    renderingCart=true;
    try{
    cart=StoreCore.normalizeCart(cart,products,maxQuantity());
    if(persist)try{localStorage.setItem(CART_KEY,JSON.stringify(cart));$('cartStorageStatus').hidden=true;}catch{$('cartStorageStatus').hidden=false;}
    UI.updateBadge(cart.reduce((n,i)=>n+i.qty,0));UI.renderCart(cart.map(i=>({...i,product:products.find(p=>p.id===i.id)})));
    $('checkoutBtn').disabled=!ready||!cart.length||cart.some(i=>!products.find(p=>p.id===i.id)?.available);
    }finally{renderingCart=false;}
  }
  function productCards(list){return list.map(p=>{
    const image=StorefrontPolicy.productImage(p.image),href=ProductPage.url(p);
    const badges=[];
    if(!p.available)badges.push('<span class="product__badge unavailable">Indisponível</span>');
    else{
      if(p.offer)badges.push('<span class="product__badge offer">Promoção</span>');
      if(p.featured)badges.push('<span class="product__badge bestseller">Mais vendido</span>');
    }
    const badgeHtml=badges.length?`<span class="product__badges">${badges.join('')}</span>`:'';
    const action=`<button type="button" class="product__btn" data-add="${p.id}">Adicionar ao carrinho ${UI.icon('plus')}</button>`;
    return `<article class="product" data-id="${p.id}"><a class="product__media" href="${href}" aria-label="Ver ${esc(p.name)}">${image?`<img class="product__img" src="${esc(image)}" alt="${esc(p.name)}" width="480" height="480"${UI.responsive(image)} decoding="async" loading="lazy">`:UI.photoPlaceholder()}${badgeHtml}</a><div class="product__body"><span class="product__category">${esc(p.categoryLabel)}</span><h3 class="product__name"><a href="${href}">${esc(p.name)}</a></h3><p class="product__dimensions">${esc(p.shortDescription||StoreCore.dimensions(p))}</p><div class="product__price-row">${p.offer?`<s class="product__price-old">De ${UI.formatPrice(p.oldPrice)}</s>`:''}<span class="product__price">${p.offer?'por ':''}${UI.formatPrice(p.price)}</span><span class="product__unit">/ ${esc(StoreCore.unitLabel(p.unit))}</span></div>${p.price!==null&&!company.confirmed?'<small class="price-disclaimer">Valor de referência</small>':''}${action}</div></article>`;
  }).join('');}
  function renderProducts(){
    const filtered=products.filter(p=>(category==='todas'||p.category===category)&&(mode!=='promotions'||p.offer)&&StoreCore.matches(p,search));
    $('productsGrid').innerHTML=productCards(filtered);$('emptyState').hidden=!ready||!!filtered.length;$('productCount').textContent='';
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
    nav.innerHTML=`<a href="/#catalogo">Todos os materiais</a>`+visible.map(c=>ProductPage.id?`<a href="/?categoria=${encodeURIComponent(c.id)}#catalogo">${esc(c.label)}</a>`:`<button data-cat="${esc(c.id)}">${esc(c.label)}</button>`).join('');
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
  let campaignTimer=null;
  function renderHero(){
    const homes=banners.filter(b=>b.placement==='home'&&b.active!==0&&StoreCore.image(b.image));
    const home=banners.find(b=>b.placement==='home');
    $('home').hidden=!home||home.active===0;
    clearInterval(campaignTimer);campaignTimer=null;
    if(homes.length){
      const slides=homes.map((b,i)=>{
        const img=StoreCore.image(b.image);
        return `<article class="home-image-banner"${i?' inert':''} aria-hidden="${i?'true':'false'}"><h1 id="heroTitle" class="sr-only">${esc(b.title)}</h1><a href="${esc(b.destination||'#catalogo')}" aria-label="${esc(b.title)}"><img src="${esc(img)}" ${UI.responsive(b.image,'100vw')} ${i?'loading="lazy"':'fetchpriority="high"'} alt="${esc(b.title)}"></a></article>`;
      }).join('');
      const controls=homes.length>1?`<button class="campaign-arrow prev home-arrow prev" type="button" aria-label="Banner anterior">${UI.icon('arrow')}</button><button class="campaign-arrow next home-arrow next" type="button" aria-label="Próximo banner">${UI.icon('arrow')}</button><div class="campaign-dots home-dots">${homes.map((b,i)=>`<button type="button" class="${i?'':'is-active'}" aria-label="Ir para o banner ${i+1}"${i?' aria-current="false"':' aria-current="true"'}></button>`).join('')}</div>`:'';
      $('heroTrack').innerHTML=`<div class="home-banner-carousel" role="region" aria-roledescription="carrossel" aria-label="Banners da loja"><div class="home-banner-track">${slides}</div>${controls}</div>`;
      setupHomeCarousel(homes.length);
    }else{
      const image=StoreCore.image(company.heroImage),illustrative=image==='assets/hero-madeira.webp';
      $('heroTrack').innerHTML=`<article class="hero-slide"><div class="hero-copy"><h1 id="heroTitle">${esc(company.heroTitle)}</h1></div><figure class="hero-figure">${image?`<img class="hero-photo" src="${esc(image)}" ${UI.responsive(image,'(max-width: 760px) 100vw, 100vw')} width="1942" height="809" fetchpriority="high" alt="${illustrative?'Tábuas empilhadas, fotografia ilustrativa':'Imagem institucional fornecida pela loja'}">`:UI.photoPlaceholder()}<figcaption>${illustrative?'Fotografia ilustrativa. Não retrata a loja.':image?'Imagem fornecida pela loja.':'Foto institucional ainda não disponível.'}</figcaption></figure><div class="hero-timber" aria-hidden="true"></div></article>`;
      const title=$('heroTitle');
      if(['Portas, tábuas e madeira para sua obra.','A madeira certa para cada projeto.'].includes(company.heroTitle)){
        title.replaceChildren(document.createTextNode('Madeira de verdade '));
        const line=document.createElement('span');line.textContent='para grandes projetos';title.append(line);
      }
      const callout=document.createElement('div');callout.className='hero-quote';
      const defaultText=['Portas, tábuas, ripas e estruturas. Encontre o que precisa e converse com nossa equipe.','Escolha os materiais e envie sua lista com as medidas para pedir um orçamento.'];
      callout.innerHTML=`<p>${esc(defaultText.includes(company.heroText)?'Soluções completas em madeiras e materiais para construção.':company.heroText)}</p><a class="btn primary" href="#catalogo">Ver produtos</a>`;
      $('heroTrack').querySelector('.hero-slide').append(callout);
    }
    const campaigns=banners.filter(b=>b.placement!=='home'&&StoreCore.image(b.image));$('campaigns').hidden=!campaigns.length;
    $('campaigns').innerHTML=campaigns.length?`<div class="campaign-carousel" role="region" aria-roledescription="carrossel" aria-label="Campanhas da loja"><div class="campaign-track">${campaigns.map((b,i)=>`<article class="campaign-slide"${i?' inert':''} aria-hidden="${i?'true':'false'}"><div class="campaign-slide-copy"><span class="eyebrow">${esc(b.tag||'NOVIDADES')}</span><h2>${esc(b.title)}</h2><p>${esc(b.body)}</p><a class="btn primary" href="${esc(b.destination||'#catalogo')}">${esc(b.cta||'Ver produtos')}</a></div>${b.image?`<a class="campaign-image-link" href="${esc(b.destination||'#catalogo')}" aria-label="${esc(b.title)}"><img class="campaign-slide-img" src="${esc(StoreCore.image(b.image))}" ${UI.responsive(b.image,'100vw')} alt="${esc(b.title)}" loading="lazy"></a>`:''}</article>`).join('')}</div>${campaigns.length>1?`<button class="campaign-arrow prev" type="button" aria-label="Campanha anterior">${UI.icon('arrow')}</button><button class="campaign-arrow next" type="button" aria-label="Próxima campanha">${UI.icon('arrow')}</button><div class="campaign-dots">${campaigns.map((b,i)=>`<button type="button" class="${i?'':'is-active'}" aria-label="Ir para a campanha ${i+1}"${i?' aria-current="false"':' aria-current="true"'}></button>`).join('')}</div>`:''}</div>`:'';
    UI.images($('heroTrack'));UI.images($('campaigns'));
    setupCampaignCarousel(campaigns.length);
  }
  function setupHomeCarousel(count){
    const carousel=document.querySelector('.home-banner-carousel');if(!carousel||count<2)return;
    const slides=[...carousel.querySelectorAll('.home-image-banner')],dots=[...carousel.querySelectorAll('.home-dots button')];
    let index=0,touchX=null;
    const go=next=>{index=(next+count)%count;
      carousel.querySelector('.home-banner-track').style.transform=`translateX(-${index*100}%)`;
      slides.forEach((s,i)=>{s.classList.toggle('is-active',i===index);s.toggleAttribute('inert',i!==index);s.setAttribute('aria-hidden',String(i!==index));});
      dots.forEach((d,i)=>{d.classList.toggle('is-active',i===index);d.setAttribute('aria-current',String(i===index));});
    };
    const start=()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;stop();campaignTimer=setInterval(()=>go(index+1),5000);};
    const stop=()=>{if(campaignTimer){clearInterval(campaignTimer);campaignTimer=null;}};
    carousel.querySelector('.home-arrow.prev').onclick=()=>{go(index-1);start();};
    carousel.querySelector('.home-arrow.next').onclick=()=>{go(index+1);start();};
    dots.forEach((d,i)=>d.onclick=()=>{go(i);start();});
    carousel.addEventListener('mouseenter',stop);carousel.addEventListener('mouseleave',start);
    carousel.addEventListener('focusin',stop);carousel.addEventListener('focusout',start);
    carousel.addEventListener('touchstart',e=>{stop();touchX=e.touches[0].clientX;},{passive:true});
    carousel.addEventListener('touchend',e=>{if(touchX!=null){const delta=e.changedTouches[0].clientX-touchX;if(Math.abs(delta)>40)go(index+(delta<0?1:-1));touchX=null;}start();},{passive:true});
    start();
  }
  function setupCampaignCarousel(count){
    const carousel=document.querySelector('.campaign-carousel');if(!carousel||count<2)return;
    const slides=[...carousel.querySelectorAll('.campaign-slide')],dots=[...carousel.querySelectorAll('.campaign-dots button')];
    let index=0,touchX=null;
    const go=next=>{index=(next+count)%count;
      carousel.querySelector('.campaign-track').style.transform=`translateX(-${index*100}%)`;
      slides.forEach((s,i)=>{s.classList.toggle('is-active',i===index);s.toggleAttribute('inert',i!==index);s.setAttribute('aria-hidden',String(i!==index));});
      dots.forEach((d,i)=>{d.classList.toggle('is-active',i===index);d.setAttribute('aria-current',String(i===index));});
    };
    const start=()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;stop();campaignTimer=setInterval(()=>go(index+1),6000);};
    const stop=()=>{if(campaignTimer){clearInterval(campaignTimer);campaignTimer=null;}};
    carousel.querySelector('.campaign-arrow.prev').onclick=()=>{go(index-1);start();};
    carousel.querySelector('.campaign-arrow.next').onclick=()=>{go(index+1);start();};
    dots.forEach((d,i)=>d.onclick=()=>{go(i);start();});
    carousel.addEventListener('mouseenter',stop);carousel.addEventListener('mouseleave',start);
    carousel.addEventListener('focusin',stop);carousel.addEventListener('focusout',start);
    carousel.addEventListener('touchstart',e=>{stop();touchX=e.touches[0].clientX;},{passive:true});
    carousel.addEventListener('touchend',e=>{if(touchX!=null){const delta=e.changedTouches[0].clientX-touchX;if(Math.abs(delta)>40)go(index+(delta<0?1:-1));touchX=null;}start();},{passive:true});
    start();
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
  function openRequest(items){
    if(!ready||!items.length)return;
    if(!company.canWhatsapp){UI.toast('O WhatsApp da loja está indisponível no momento.');return;}
    let message;try{message=StoreCore.shoppingMessage(items,products,company);}catch(error){UI.toast(error.message);return;}
    UI.closeProductModal();UI.closeDrawer();
    let url=whatsappUrl(company.whatsapp,message);
    if(url.length>16000){
      $('quoteFullMessage').value=message;$('quoteWhats').href=url='https://wa.me/'+company.whatsapp;
      $('quoteDialog').showModal();
      navigator.clipboard?.writeText(message).catch(()=>{});
    }
    event('whatsapp_click',undefined,'quote_continue',[...new Set(items.map(i=>i.id))]);
    let tab=null;try{tab=window.open(url,'_blank');if(tab)tab.opener=null;}catch{}
    if(!tab)location.assign(url);
  }
  function requestProduct(id,qty=1,details={}){const p=products.find(p=>p.id===id);if(!validItem(p,qty))return;if(p.stock!==null&&qty>p.stock){UI.toast('Quantidade maior que o estoque disponível.');return;}openRequest([{id,qty,lineKey:`p${id}`,measures:details.measures||'',specifications:details.specifications||'',...details.measurement?{measurement:details.measurement}:{}}]);}
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
      if(add&&!add.disabled){const p=products.find(p=>p.id===Number(add.dataset.add));if(p&&['m','m2','m3'].includes(p.unit)){location.assign(ProductPage.url(p));return;}if(addToCart(Number(add.dataset.add)))UI.toast('Produto adicionado ao carrinho.');return;}
      if(details){const p=products.find(p=>p.id===Number(details.dataset.details));if(p){location.assign(ProductPage.url(p));}return;}
    });
    $('cartItems').onclick=e=>{const up=e.target.closest('[data-qty-inc]'),down=e.target.closest('[data-qty-dec]'),remove=e.target.closest('[data-remove]');if(up)incCart(up.dataset.qtyInc);if(down)decCart(down.dataset.qtyDec);if(remove)removeFromCart(remove.dataset.remove);};
    $('cartItems').onchange=e=>{if(e.target.matches('[data-qty]'))return setQuantity(e.target.dataset.qty,Number(e.target.value));const item=cartItem(e.target.dataset.measures || e.target.dataset.specifications);if(!item)return;if(e.target.matches('[data-measures]'))item.measures=e.target.value.slice(0,500);if(e.target.matches('[data-specifications]'))item.specifications=e.target.value.slice(0,1000);saveCart();};
    $('productModal').onclick=e=>{if(e.target===$('productModal'))UI.closeProductModal();};$('quoteClose').onclick=$('quoteDone').onclick=()=>$('quoteDialog').close();$('quoteCopy').onclick=async()=>{const report=$('quoteFullMessage');try{await navigator.clipboard.writeText(report.value);UI.toast('Lista copiada. Cole na conversa do WhatsApp.');}catch{report.focus();report.select();UI.toast('Selecione e copie a lista completa.');}};
    for(const id of ['headerWhats','waFloat','contactWhats'])$(id).onclick=()=>{if(company.canWhatsapp)event('whatsapp_click',undefined,{headerWhats:'header',waFloat:'floating',contactWhats:'contact'}[id]);};
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){UI.closeProductModal();UI.closeDrawer();}if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();$('searchInput').focus();}});
    window.addEventListener('storage',e=>{if(e.key===CART_KEY&&ready){cart=loadCart();saveCart(false);}});window.addEventListener('focus',refresh);setInterval(refresh,30000);if(location.hash==='#promocoes')mode='promotions';search=new URLSearchParams(location.search).get('busca')||'';category=new URLSearchParams(location.search).get('categoria')||'todas';$('searchInput').value=search;load().then(()=>{if(ProductPage.id&&ready)event('product_view',ProductPage.id,'product_page');});
  }
  document.addEventListener('DOMContentLoaded',init);return {addToCart,incCart,decCart,removeFromCart,requestProduct,maxQuantity};
})();
