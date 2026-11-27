// A visitor can alternate recordings without two sources playing at once.
document.addEventListener('play', (event) => {
  if (!(event.target instanceof HTMLMediaElement)) return;
  document.querySelectorAll('audio, video').forEach((media) => {
    if (media !== event.target) media.pause();
  });
}, true);

function keepSectionAcrossLanguages() {
  const section = ['#listen', '#archive'].includes(location.hash) ? location.hash : '';
  for (const link of document.querySelectorAll('.mast [hreflang]')) link.hash = section;
}
keepSectionAcrossLanguages();
window.addEventListener('hashchange', keepSectionAcrossLanguages);
