// Presentation only: preserve stored settings and product images.
globalThis.StorefrontPolicy=Object.freeze({
  productImage(value) {
    const image=StoreCore.image(value);
    const seedPhoto=/^https:\/\/images\.unsplash\.com\/photo-(?:1558959356-2f3f6c0d62fa|1500382017468-9049fed747ef|1542621334-a254cf47733d|1601142888860-b60d29f12ce0|1600585154340-be6161a56a0c|1505691938895-1758d7feb511|1597918216049-1f1a36d9f4d4|1597007030739-6d2e7172ee6e|1516455590571-18256e5bb9ff|1601054831128-9c4a76b1c1d8)(?:\?|$)/;
    return seedPhoto.test(image)||image==='assets/hero-madeira.webp'?'':image;
  },
  company(input) {
    const confirmed=input.confirmed===true;
    const replacements={
      heroTitle:['A madeira certa para cada projeto.','Portas, tábuas e madeira para sua obra.'],
      heroText:['Portas, tábuas, ripas e estruturas. Encontre o que precisa e converse com nossa equipe.','Escolha os materiais e envie sua lista com as medidas para pedir um orçamento.'],
      aboutTitle:['Madeira para construir suas ideias.','Peça um orçamento com as medidas da sua obra.'],
      aboutText:['Conheça nosso catálogo e solicite um orçamento com as medidas do seu projeto.','Adicione os produtos à lista e informe as medidas de que precisa. Nossa equipe confere os preços e a disponibilidade e combina a entrega com você.'],
      footerText:['Madeira para sua obra. Atendimento para o seu projeto.','Envie sua lista de materiais e confirme as condições com a nossa equipe.']
    };
    const company={...input,confirmed,logo:StoreCore.image(input.logo)||'assets/brand/logo-progresso.png'};
    for(const [key,[previous,next]] of Object.entries(replacements)) if(!company[key]||company[key]===previous) company[key]=next;
    if(!confirmed) Object.assign(company,{phone:'Dados de atendimento em atualização',address:'Endereço aguardando confirmação',hours:'Horários aguardando confirmação.',region:'Retirada e região de entrega a confirmar.',whatsapp:''});
    if(input.whatsappConfirmed===true)company.whatsapp=input.whatsapp;
    company.canWhatsapp=(confirmed||input.whatsappConfirmed===true)&&StoreCore.validWhatsapp(company.whatsapp);
    return company;
  },
  isSeedBanner(banner) {
    const seeds=[['CATÁLOGO','Madeira para sua obra','Conheça os produtos e solicite seu orçamento.'],['ENTREGA','Consulte a entrega','Informe seu endereço para confirmar prazo e valor do frete.'],['ORÇAMENTO','Converse com a equipe','Confirme preços e condições de pagamento antes de fechar seu pedido.']];
    return !banner.image&&(!banner.destination||banner.destination==='#catalogo')&&(!banner.cta||banner.cta==='Ver catálogo')&&seeds.some(([tag,title,body])=>banner.tag===tag&&banner.title===title&&banner.body===body);
  }
});
