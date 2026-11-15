document.querySelector('#load-video')?.addEventListener('click', () => {
  const frame = document.createElement('iframe');
  frame.src = 'https://www.youtube-nocookie.com/embed/p-d13dCQQIo?autoplay=1&rel=0';
  frame.title = 'Video di presentazione fatt APPost';
  frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.allowFullscreen = true;
  document.querySelector('#video-shell').replaceChildren(frame);
  frame.focus();
});
