// links.js
const PLACEHOLDER = '/assets/videos/blackbloc_rendered_final.MP4';

// Explicit mappings (both variants to ensure correct linking):
const specificLinks = {
  BlackBloc: '/assets/videos/blackbloc_rendered_final.MP4',
  BlackBloc_video: '/assets/videos/blackbloc_rendered_final.MP4',

  Escapism: '/assets/videos/escapeism_rendered_final.mp4',
  Escapism_video: '/assets/videos/escapeism_rendered_final.mp4',

  // Keep other mappings for potential future videos
  CostumedPlay: '/assets/videos/blackbloc_rendered_final.MP4', // Fallback to available video
  CostumedPlay_video: '/assets/videos/blackbloc_rendered_final.MP4'
};

export const LINK_MAP = new Proxy(specificLinks, {
  get: (obj, key) => obj[key] || PLACEHOLDER
});

// Color mapping - these make the nodes clickable (using exact node names from data.js)
export const LINK_COLOR_MAP = {
  "BlackBloc": "#FF4444",    // Red for BlackBloc activism
  "Escapism": "#44FF44"      // Green for Escapism
};
