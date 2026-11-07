/* Optional scene-backed narration. Existing authenticated course video stays the fallback. */
(function (root) {
  'use strict';
  root.LilbirdSoloMedia = {
    mount: function (video, poster, session, loadExisting) {
      var media = session.narratedMedia;
      var fallbackUsed = !media;
      function fallback() {
        if (fallbackUsed) return;
        fallbackUsed = true;
        video.querySelectorAll('track').forEach(function (track) { track.remove(); });
        video.removeAttribute('poster');
        video.style.objectFit = '';
        if (session.videoKey) loadExisting(video, session.videoKey);
        else {
          poster.classList.remove('hidden');
          var label = poster.querySelector('.video-label');
          if (label) label.textContent = 'Video unavailable right now. Please try again later.';
        }
      }
      video.controls = true;
      video.setAttribute('aria-label', session.title + ': a word from Luke');
      if (media && media.src && media.scene) {
        video.src = media.src;
        video.poster = media.scene;
        video.style.objectFit = 'cover';
        poster.style.backgroundImage = "url(" + JSON.stringify(media.scene) + ")";
        if (media.captions) {
          var track = document.createElement('track');
          track.kind = 'captions'; track.src = media.captions;
          track.srclang = media.language || 'en'; track.label = media.captionLabel || 'English'; track.default = true;
          video.appendChild(track);
        }
        video.addEventListener('error', fallback);
      } else {
        fallbackUsed = true;
        loadExisting(video, session.videoKey);
      }
      poster.addEventListener('click', function () {
        video.play().catch(function () {
          var label = poster.querySelector('.video-label');
          if (label) label.textContent = 'Unable to play. Try again in a moment.';
        });
      });
      video.addEventListener('loadedmetadata', function () {
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        var seconds = Math.floor(video.duration);
        var label = poster.querySelector('.video-label');
        if (label) label.textContent = 'A word from Luke · ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
      });
      video.addEventListener('playing', function () { poster.classList.add('hidden'); });
      video.addEventListener('ended', function () { poster.classList.remove('hidden'); });
      // Leave native controls exposed while paused, including seeking and captions.
    }
  };
})(window);
