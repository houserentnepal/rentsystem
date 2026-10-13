/* Nepal Rent Hub - shared browser client. Replace API_URL below after deployment. */
const API_URL = 'https://script.google.com/macros/s/AKfycbzRabcR_bQqWWC-aN_6TfWnQaHahYwgIqx3heIpnQItUDbWEz13RTC2parJrM8fh3DV/exec';
const API_READY = API_URL.startsWith('https://script.google.com/macros/s/');
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (value) => 'रु. ' + Number(value || 0).toLocaleString('en-IN');
const t = (ne,en) => localStorage.getItem('nrh_lang') === 'en' ? en : ne;
function setLanguage(value) { localStorage.setItem('nrh_lang',value); location.reload(); }
function message(el,text,type='notice') { el.className=type; el.textContent=text; }
function jsonp(action,params={}) {
  return new Promise((resolve,reject) => {
    if (!API_READY) return reject(Error('Set API_URL in app.js first.'));
    const name='nrhcb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const script=document.createElement('script');
    const timeout=setTimeout(()=>done(Error('Connection timeout')),20000);
    function done(error,data) { clearTimeout(timeout);delete window[name];script.remove();error?reject(error):resolve(data); }
    window[name]=(data)=>done(null,data);
    script.onerror=()=>done(Error('Could not connect to Google Apps Script'));
    const query=new URLSearchParams({action,callback:name,...params});
    script.src=API_URL+'?'+query.toString();document.head.appendChild(script);
  });
}
function post(payload) {
  return new Promise((resolve,reject) => {
    if (!API_READY) return reject(Error('Set API_URL in app.js first.'));
    const id=crypto.randomUUID(),frame=document.createElement('iframe'),form=document.createElement('form');
    frame.name='nrhframe_'+id;frame.style.display='none';form.style.display='none';
    form.method='POST';form.action=API_URL;form.target=frame.name;
    const input=document.createElement('input');input.name='payload';input.value=JSON.stringify({...payload,origin:location.origin,requestId:id});form.append(input);
    let timer;
    function cleanup(){clearTimeout(timer);window.removeEventListener('message',receive);form.remove();frame.remove();}
    function receive(event) {
      if(event.source!==frame.contentWindow || !event.origin.endsWith('.googleusercontent.com')) return;
      if(!event.data || event.data.requestId!==id) return;
      const data=event.data;cleanup();data.ok?resolve(data.data):reject(Error(data.error||'Request failed'));
    }
    window.addEventListener('message',receive);document.body.append(frame,form);
    timer=setTimeout(()=>{cleanup();reject(Error('Submission timed out. Check the sheet before retrying.'));},30000);
    form.submit();
  });
}
function safeImage(url) { try {const u=new URL(url);return ['https:'].includes(u.protocol)?u.href:'';}catch{return '';} }
function showPhoto(url) { const safe=safeImage(url);return safe?`<img src="${esc(safe)}" alt="Property photo" loading="lazy" referrerpolicy="no-referrer">`:'<div class="placeholder">🏠</div>'; }
