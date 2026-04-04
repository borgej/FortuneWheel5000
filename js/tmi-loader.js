// Load tmi.js with fallbacks (unpkg)
(function loadTmi(urls){
  function tryNext(i){
    if(i>=urls.length){ console.error('Failed to load tmi.js'); return; }
    var s=document.createElement('script');
    s.src=urls[i];
    s.async=true;
    s.onload=function(){ console.log('tmi.js loaded from', urls[i]); };
    s.onerror=function(){ console.warn('tmi.js failed from', urls[i]); tryNext(i+1); };
    document.head.appendChild(s);
  }
  tryNext(0);
})([
  './tmi.min.js',
  './tmi.js',
  'https://unpkg.com/tmi.js@1.8.5/dist/tmi.min.js'
]);
