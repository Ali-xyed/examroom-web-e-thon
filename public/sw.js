const cacheName='uncooked-final-v1'
const shell=['/login','/index.html','/styles.css','/site.css','/app.js','/api.js','/config.js','/site.js','/phase-two.js','/phase-three.js','/import-preview.js','/report-pdf.js','/reference/uc-logo.png']
self.addEventListener('install',event=>{event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(shell)).then(()=>self.skipWaiting()))})
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==cacheName).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))})
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url)
 if(event.request.method!=='GET'||url.origin!==location.origin) return
 event.respondWith(fetch(event.request).then(response=>{
   if(response.ok&&shell.includes(url.pathname)) {const clone=response.clone();caches.open(cacheName).then(cache=>cache.put(url.pathname,clone))}
   return response
 }).catch(()=>caches.match(event.request,{ignoreSearch:true}).then(response=>response||(event.request.mode==='navigate'?caches.match('/login'):Response.error()))))
})
