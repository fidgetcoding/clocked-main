/// <reference types="vite/client" />

interface Window {
  // Older Safari only has the prefixed constructor
  webkitAudioContext?: typeof AudioContext;
}
