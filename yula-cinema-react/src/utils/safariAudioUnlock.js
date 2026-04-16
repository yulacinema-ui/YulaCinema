export const unlockAudioForSafari = () => {
  return new Promise((resolve) => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      resolve();
      return;
    }

    const audioCtx = new AudioContext();
    if (audioCtx.state === 'running') {
      resolve();
      return;
    }

    // Create silent buffer and play it to unlock
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);

    audioCtx.resume().then(() => {
      source.stop();
      audioCtx.close();
      resolve();
    }).catch(() => {
      // Fallback: try playing a dummy HTMLAudioElement
      const dummy = new Audio();
      dummy.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      dummy.play().then(() => {
        dummy.pause();
        dummy.currentTime = 0;
        resolve();
      }).catch(() => resolve());
    });
  });
};