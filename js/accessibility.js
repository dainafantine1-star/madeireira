/* Native dialogs provide their own focus trap. Custom panels use inert + a focus loop. */
(()=>{
  let active=null,opener=null,background=[];
  const focusable=root=>[...root.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(n=>!n.disabled&&n.tabIndex>=0&&!n.closest('[hidden],[inert]')&&n.getClientRects().length);
  const restore=node=>{if(node?.isConnected&&!node.closest('[hidden],[inert]'))node.focus();else (document.getElementById('main')||document.getElementById('searchInput'))?.focus();};
  function sync(){
    const next=[...document.querySelectorAll('#cartDrawer,#productModal')].find(n=>n.classList.contains('is-open'))||null;
    if(next===active)return;
    for(const [n,prior]of background)n.inert=prior;background=[];
    if(active){active.inert=true;if(!document.querySelector('dialog[open]'))restore(opener);}
    active=next;if(!active)return;
    opener=active._opener||document.activeElement;active.inert=false;
    for(const n of document.body.children)if(n!==active&&n.id!=='overlay'&&n.tagName!=='SCRIPT'&&n.tagName!=='DIALOG'){background.push([n,n.inert]);n.inert=true;}
    focusable(active)[0]?.focus();
  }
  document.addEventListener('DOMContentLoaded',()=>{
    for(const panel of document.querySelectorAll('#cartDrawer,#productModal')){panel.inert=!panel.classList.contains('is-open');new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['class']});}
    document.addEventListener('keydown',e=>{if(e.key!=='Tab'||!active||document.querySelector('dialog[open]'))return;const list=focusable(active),first=list[0],last=list.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||!active.contains(document.activeElement))){last.focus();e.preventDefault();}else if(!e.shiftKey&&(document.activeElement===last||!active.contains(document.activeElement))){first.focus();e.preventDefault();}});
    for(const dialog of document.querySelectorAll('dialog')){let returnFocus;new MutationObserver(()=>{if(dialog.open){returnFocus=dialog._opener||returnFocus;}else{sync();restore(returnFocus);}}).observe(dialog,{attributes:true,attributeFilter:['open']});const original=dialog.showModal.bind(dialog);dialog.showModal=()=>{dialog._opener=document.activeElement;returnFocus=dialog._opener;original();};}
  });
})();
