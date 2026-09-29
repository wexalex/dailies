/* Referenz- und Projektseiten: Teaser mit Klick starten, kurze Loops nur
   abspielen, solange sie im Bild sind. Kein Framework, keine Abhaengigkeiten. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Teaser mit Ton: erst der Klick laedt und startet das Video.
  document.querySelectorAll("[data-play]").forEach(function (wrap) {
    var video = wrap.querySelector("video");
    var knopf = wrap.querySelector(".play-btn");
    if (!video || !knopf) return;
    knopf.addEventListener("click", function () {
      knopf.remove();
      video.muted = false;
      video.controls = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    });
  });

  // Stumme Loops: sichtbar = spielen, unsichtbar = Pause. Wer reduzierte
  // Bewegung eingestellt hat, sieht nur das Posterbild.
  var loops = Array.prototype.slice.call(document.querySelectorAll("video[data-loop]"));
  if (reduce || !loops.length) return;
  function anspielen(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (e.isIntersecting) anspielen(e.target);
        else e.target.pause();
      });
    }, { rootMargin: "160px" });
    loops.forEach(function (v) { io.observe(v); });
  } else {
    loops.forEach(anspielen);
  }
})();
