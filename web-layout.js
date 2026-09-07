(function(){
'use strict';
if(window.__PFP_WEB_LAYOUT_R14)return;window.__PFP_WEB_LAYOUT_R14=true;
let queued=false;
const set=(e,k,v)=>{if(e)e.style.setProperty(k,v,'important');};
function titleNode(){return [...document.querySelectorAll('div,span,h1,h2,h3')].filter(e=>e.children.length===0&&(e.textContent||'').trim().toUpperCase()==='SELECT GAME'&&e.getClientRects().length).sort((a,b)=>b.getBoundingClientRect().left-a.getBoundingClientRect().left)[0]||null;}
function fit(){
 const title=titleNode();if(!title)return;
 let landing=title.parentElement;for(let i=0;i<6&&landing&&landing.querySelectorAll('img').length<2;i++)landing=landing.parentElement;if(!landing)return;
 const kids=[...landing.children];const grid=kids.find(e=>e!==title&&e.querySelectorAll&&e.querySelectorAll('img').length>=2)||title.nextElementSibling;
 const cards=grid?[...grid.children].filter(e=>e.querySelector&&e.querySelector('img')).slice(0,2):[];
 const compact=innerHeight<900;
 set(landing,'position','relative');set(landing,'height','auto');set(landing,'min-height','0');set(landing,'max-height','none');set(landing,'padding',compact?'11px 15px 10px':'13px 17px 11px');set(landing,'gap',compact?'8px':'10px');set(landing,'overflow','visible');set(landing,'align-content','start');set(landing,'box-sizing','border-box');
 set(title,'font-size',compact?'18px':'19px');set(title,'line-height','1.05');set(title,'margin','0');
 if(grid){set(grid,'display','grid');set(grid,'grid-template-columns','1fr');set(grid,'gap',compact?'9px':'10px');set(grid,'row-gap',compact?'9px':'10px');}
 for(const card of cards){const h=compact?'148px':'154px';set(card,'height',h);set(card,'min-height',h);set(card,'max-height',h);set(card,'border-radius','12px');const img=card.querySelector('img');if(img){set(img,'width',compact?'226px':'236px');set(img,'height','auto');set(img,'max-height',compact?'94px':'100px');set(img,'object-fit','contain');}}
 const lv=document.getElementById('landing-version');if(!lv)return;if(lv.parentElement!==landing)landing.appendChild(lv);
 set(lv,'position','relative');set(lv,'display','block');set(lv,'width','100%');set(lv,'height','auto');set(lv,'min-height','0');set(lv,'max-height','none');set(lv,'margin','0');set(lv,'padding','0');set(lv,'transform','none');set(lv,'overflow','visible');set(lv,'z-index','20');
 const pc=lv.querySelector('.landing-patch-card');if(pc){set(pc,'position','relative');set(pc,'width','calc(100% - 4px)');set(pc,'max-width','none');set(pc,'height','auto');set(pc,'min-height','0');set(pc,'max-height','none');set(pc,'margin','0 auto');set(pc,'padding',compact?'4px 7px 5px':'5px 8px 6px');set(pc,'transform','none');set(pc,'overflow','visible');set(pc,'box-sizing','border-box');const pt=pc.querySelector('.landing-patch-title');if(pt){set(pt,'font-size',compact?'9px':'9.5px');set(pt,'line-height','1');set(pt,'margin','0 0 2px');}const lines=pc.querySelector('.landing-patch-lines');if(lines){set(lines,'font-size',compact?'7.5px':'7.8px');set(lines,'line-height','1.07');set(lines,'column-gap','9px');}for(const c of pc.querySelectorAll('.landing-patch-col')){set(c,'gap','0');set(c,'margin','0');}const wide=pc.querySelector('.landing-patch-wide');if(wide){set(wide,'margin-top','2px');set(wide,'line-height','1.07');}}
 const scene=document.getElementById('SceneSelect');if(scene){set(scene,'overflow-y','visible');set(scene,'overflow','visible');}
}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;fit();});}
queue();window.addEventListener('load',()=>{queue();setTimeout(queue,40);setTimeout(queue,120);setTimeout(queue,350);setTimeout(queue,900);});window.addEventListener('resize',queue);window.addEventListener('hashchange',queue,true);window.addEventListener('popstate',queue,true);new MutationObserver(queue).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style']});
})();
