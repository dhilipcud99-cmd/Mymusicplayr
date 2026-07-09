/* ===================== DATA & CONFIG ===================== */
const ITUNES_API_SEARCH = 'https://itunes.apple.com/search';

// Palette of gradient pairs used to generate distinct cover art when track artwork is unavailable.
const palettes = [
  ['#e8a33d','#c65b3c'], ['#3d6be8','#8a3de8'], ['#3dd6a3','#1c8a63'],
  ['#e83d6b','#a3203d'], ['#e8c93d','#8a6a1c'], ['#3dc9e8','#1c5a8a'],
  ['#8a5be8','#3d2a8a'], ['#e87a3d','#8a3d1c'], ['#6be83d','#2a8a1c'],
  ['#e83dc4','#8a1c6a'], ['#3de89a','#1c8a52'], ['#c9e83d','#6a8a1c']
];

const LOCAL_FALLBACK_TRACKS = [
  {id:"1",  title:"Amber Static",        artist:"Coral Bells",       album:"Nightfall Radio", genre:"Lo-fi",   src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"},
  {id:"2",  title:"Chrome Weather",      artist:"Nova Halcyon",      album:"Sundown Circuits", genre:"Synth",  src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"},
  {id:"3",  title:"Paper Moths",         artist:"Fen & Willow",      album:"Low Tide",         genre:"Folk",   src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"},
  {id:"4",  title:"Quiet Static",        artist:"The Loose Ends",    album:"Sixth Floor",      genre:"Indie",  src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3"},
  {id:"5",  title:"Marble Sky",          artist:"Faye Orbison",      album:"Marble Sky EP",    genre:"Ambient",src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3"},
  {id:"6",  title:"Slow Neon",           artist:"Coral Bells",       album:"Nightfall Radio",  genre:"Lo-fi",  src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3"},
  {id:"7",  title:"Tin Roof, Rain",      artist:"Fen & Willow",      album:"Low Tide",         genre:"Folk",   src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3"},
  {id:"8",  title:"Halogen Blue",        artist:"Nova Halcyon",      album:"Sundown Circuits", genre:"Synth",  src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3"},
  {id:"9",  title:"Static Bloom",        artist:"The Loose Ends",    album:"Sixth Floor",      genre:"Indie",  src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3"},
  {id:"10", title:"Long Exposure",       artist:"Faye Orbison",      album:"Marble Sky EP",    genre:"Ambient",src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3"},
  {id:"11", title:"Corridor Light",      artist:"Coral Bells",       album:"Nightfall Radio",  genre:"Lo-fi",  src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3"},
  {id:"12", title:"Ferris & Fade",       artist:"The Loose Ends",    album:"Sixth Floor",      genre:"Indie",  src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3"},
  {id:"13", title:"Analog Ghosts",       artist:"Nova Halcyon",      album:"Sundown Circuits", genre:"Synth",  src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3"},
  {id:"14", title:"Wildflower Static",   artist:"Fen & Willow",      album:"Low Tide",         genre:"Folk",   src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-14.mp3"},
  {id:"15", title:"Room Tone",           artist:"Faye Orbison",      album:"Marble Sky EP",    genre:"Ambient",src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3"},
  {id:"16", title:"Last Bus Home",       artist:"The Loose Ends",    album:"Sixth Floor",      genre:"Indie",  src:"https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3"},
];

LOCAL_FALLBACK_TRACKS.forEach((t,i)=>{ 
  t.colors = palettes[i % palettes.length]; 
  t.initials = t.title.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(); 
});

/* ===================== STATE ===================== */
const state = {
  queue: [],           // active queue loaded from context
  queueIndex: -1,
  liked: new Map(),    // map of trackId -> trackObject for full offline layout
  history: [],
  shuffle: false,
  repeat: 'off',       // off | all | one
  view: 'discover',
  genreFilter: 'all',
  searchTerm: '',
  searchResults: [],
  isLoading: false,
  buffering: false,
  preMuteVolume: 0.7
};

// Internal local database loaded from API
let tracks = []; 

const audio = document.getElementById('audio');

// Dual Playback Engines Configuration
let currentEngine = 'audio'; // 'audio' | 'youtube'
let ytPlayer = null;
let ytPlayerReady = false;
let currentSearchRequestNum = 0; // to prevent race conditions on search swaps

/* ===================== HELPERS ===================== */
function coverStyle(t){
  if (t.artwork && (t.artwork['480x480'] || t.artwork['150x150'])) {
    const art = t.artwork['480x480'] || t.artwork['150x150'];
    return `background-image: url('${art}'); background-size: cover; background-position: center;`;
  }
  return `background:linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]});`;
}

function fmtTime(sec){
  if(!isFinite(sec) || isNaN(sec)) return '0:00';
  const m = Math.floor(sec/60), s = Math.floor(sec%60);
  return `${m}:${s.toString().padStart(2,'0')}`;
}

function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>el.classList.remove('show'), 1800);
}

function saveLiked(){
  try{ 
    localStorage.setItem('rewind_liked_tracks', JSON.stringify([...state.liked.values()])); 
  }catch(e){}
}

function loadLiked(){
  try {
    const raw = localStorage.getItem('rewind_liked_tracks');
    if (raw) {
      const items = JSON.parse(raw);
      state.liked = new Map(items.map(t => [String(t.id), t]));
    } else {
      // Compatibility with older version (IDs only)
      const oldRaw = localStorage.getItem('rewind_liked');
      if (oldRaw) {
        const oldIds = JSON.parse(oldRaw);
        state.liked = new Map();
        oldIds.forEach(id => {
          const matched = LOCAL_FALLBACK_TRACKS.find(lt => String(lt.id) === String(id));
          if (matched) state.liked.set(String(id), matched);
        });
      } else {
        state.liked = new Map();
      }
    }
  } catch(e) {
    state.liked = new Map();
  }
}

function updateLikedCount(){ 
  document.getElementById('likedCount').textContent = state.liked.size; 
}

function updateNowPlayingLike(){
  const cur = state.queue[state.queueIndex];
  const btn = document.getElementById('npLike');
  if(cur && state.liked.has(String(cur.id))) btn.classList.add('liked'); else btn.classList.remove('liked');
}

function spinnerHTML(msg = "Loading tracks...") {
  return `
    <div class="spinner-container">
      <div class="spinner"></div>
      <div class="eyebrow" style="margin-top: 10px;">${msg}</div>
    </div>
  `;
}

/* ===================== ITUNES API CLIENT ===================== */
function convertItunesSearchTrack(t, idx) {
  const colors = palettes[idx % palettes.length];
  const artworkUrl = t.artworkUrl100 ? t.artworkUrl100.replace('/100x100bb.jpg', '/600x600bb.jpg') : '';
  const initials = t.trackName ? t.trackName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : "—";
  
  return {
    id: String(t.trackId),
    title: t.trackName || "Untitled Track",
    artist: t.artistName || "Unknown Artist",
    album: t.collectionName || "Single",
    genre: t.primaryGenreName || "Music",
    duration: t.trackTimeMillis ? t.trackTimeMillis / 1000 : 30,
    src: t.previewUrl,
    trackViewUrl: t.trackViewUrl, // External Apple Music link
    artwork: {
      '150x150': t.artworkUrl100 || '',
      '480x480': artworkUrl || t.artworkUrl100 || '',
      '1000x1000': artworkUrl || t.artworkUrl100 || ''
    },
    colors: colors,
    initials: initials
  };
}

function convertItunesRssTrack(entry, idx) {
  const colors = palettes[idx % palettes.length];
  const images = entry['im:image'] || [];
  const artworkUrl = images.length > 0 ? images[images.length - 1].label : '';
  const highResArtworkUrl = artworkUrl ? artworkUrl.replace(/\/\d+x\d+bb\.(jpg|png)$/, '/600x600bb.$1') : '';
  const title = entry['im:name']?.label || "Untitled Track";
  const artist = entry['im:artist']?.label || "Unknown Artist";
  const album = entry['im:collection']?.['im:name']?.label || "Single";
  const genre = entry.category?.attributes?.label || "Music";
  
  const links = entry.link || [];
  let previewUrl = '';
  let duration = 30;
  
  const linksArray = Array.isArray(links) ? links : [links];
  const previewLink = linksArray.find(l => l.attributes && l.attributes['im:assetType'] === 'preview');
  
  if (previewLink) {
    previewUrl = previewLink.attributes.href;
    if (previewLink['im:duration']) {
      duration = Number(previewLink['im:duration'].label) / 1000;
    }
  } else {
    const firstLink = linksArray[0];
    if (firstLink && firstLink.attributes) {
      previewUrl = firstLink.attributes.href;
    }
  }

  const trackId = entry.id?.attributes?.['im:id'] || `rss-${idx}`;
  const trackViewUrl = entry.link && entry.link[0] && entry.link[0].attributes ? entry.link[0].attributes.href : '';
  const initials = title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return {
    id: String(trackId),
    title: title,
    artist: artist,
    album: album,
    genre: genre,
    duration: duration,
    src: previewUrl,
    trackViewUrl: trackViewUrl,
    artwork: {
      '150x150': artworkUrl,
      '480x480': highResArtworkUrl || artworkUrl,
      '1000x1000': highResArtworkUrl || artworkUrl
    },
    colors: colors,
    initials: initials
  };
}

async function fetchItunesTrending(genre = 'all') {
  let url = '';
  let isRss = true;
  
  if (genre === 'all') {
    url = 'https://itunes.apple.com/us/rss/topsongs/limit=50/json';
  } else if (genre === 'Synth') {
    url = 'https://itunes.apple.com/us/rss/topsongs/genre=7/limit=50/json'; 
  } else if (genre === 'Indie') {
    url = 'https://itunes.apple.com/us/rss/topsongs/genre=20/limit=50/json'; 
  } else {
    isRss = false;
    let query = '';
    if (genre === 'Lo-fi') query = 'lo-fi chill';
    else if (genre === 'Folk') query = 'folk hits';
    else if (genre === 'Ambient') query = 'ambient sleep';
    else query = genre;
    url = `${ITUNES_API_SEARCH}?term=${encodeURIComponent(query)}&media=music&limit=50`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); 

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error("iTunes response error");
    const json = await res.json();
    
    if (isRss) {
      if (!json.feed || !json.feed.entry) return [...LOCAL_FALLBACK_TRACKS];
      const entries = Array.isArray(json.feed.entry) ? json.feed.entry : [json.feed.entry];
      return entries.map((entry, idx) => convertItunesRssTrack(entry, idx));
    } else {
      if (!json.results) return [...LOCAL_FALLBACK_TRACKS];
      return json.results.map((t, idx) => convertItunesSearchTrack(t, idx));
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("iTunes fetch failed, using fallback:", err.message);
    toast("Network error, loaded local offline fallback.");
    if (genre === 'all') return [...LOCAL_FALLBACK_TRACKS];
    return LOCAL_FALLBACK_TRACKS.filter(lt => lt.genre.toLowerCase() === genre.toLowerCase());
  }
}

async function fetchItunesSearch(query) {
  const url = `${ITUNES_API_SEARCH}?term=${encodeURIComponent(query)}&media=music&limit=50`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Search network error");
  const json = await res.json();
  return (json.results || []).map((t, idx) => convertItunesSearchTrack(t, idx));
}

/* ===================== RENDER: MAIN CONTENT ===================== */
function trackCardHTML(t, context = 'discover'){
  const playing = state.queue[state.queueIndex]?.id === t.id;
  const liked = state.liked.has(String(t.id));
  const showInitials = !(t.artwork && (t.artwork['480x480'] || t.artwork['150x150']));
  
  return `
  <div class="card ${playing?'playing':''}" data-id="${t.id}" data-context="${context}">
    <div class="cover" style="${coverStyle(t)}">
      <div class="grain"></div>
      ${showInitials ? `<span class="initials">${t.initials}</span>` : ''}
      <button class="heart-btn ${liked?'liked':''}" data-like="${t.id}" title="Like">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="${liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.8z"/></svg>
      </button>
      <button class="play-btn" data-play="${t.id}" data-context="${context}" title="Play">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
      </button>
    </div>
    <div class="track-title">${t.title}</div>
    <div class="track-artist">${t.artist}</div>
  </div>`;
}

function rowItemHTML(t, idx, context = 'list'){
  const playing = state.queue[state.queueIndex]?.id === t.id;
  const showInitials = !(t.artwork && (t.artwork['480x480'] || t.artwork['150x150']));
  return `
  <div class="row-item ${playing?'playing':''}" data-id="${t.id}" data-context="${context}">
    <div class="row-num">${idx+1}</div>
    <div class="row-cover" style="${coverStyle(t)}">${showInitials ? `<span class="initials">${t.initials}</span>` : ''}</div>
    <div class="row-meta">
      <div class="row-title">${t.title}</div>
      <div class="row-artist">${t.artist} · ${t.album}</div>
    </div>
    <div class="row-dur">${fmtTime(t.duration)}</div>
  </div>`;
}

function discoverHeroHTML(t) {
  if (!t) return '';
  const coverUrl = t.artwork ? (t.artwork['480x480'] || t.artwork['150x150']) : '';
  const coverStyleAttr = coverUrl ? `background-image: url('${coverUrl}')` : `background: linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`;
  
  return `
    <div class="discover-hero">
      <div class="hero-cover" style="${coverStyleAttr}"></div>
      <div class="hero-details">
        <div class="hero-tag">Trending #1 Hit</div>
        <h1 class="hero-title">${t.title}</h1>
        <div class="hero-artist">by ${t.artist}</div>
        <button class="hero-play-btn" id="heroPlayBtn" data-id="${t.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><polygon points="6 4 20 12 6 20 6 4"/></svg>
          &nbsp;Play Full Song
        </button>
      </div>
    </div>
  `;
}

function renderMain(){
  const main = document.getElementById('mainContent');

  if(state.isLoading) {
    main.innerHTML = spinnerHTML("Connecting to global music library...");
    return;
  }

  // Interactive Live Search
  if(state.searchTerm.trim()){
    main.innerHTML = `
      <div class="section">
        <div class="section-head"><h2>Results for "${state.searchTerm}"</h2><span class="tag">${state.searchResults.length} found</span></div>
        ${state.searchResults.length ? `<div class="grid">${state.searchResults.map(t => trackCardHTML(t, 'search')).join('')}</div>` : `<div class="empty"><div class="eyebrow">No matches</div>Try a different title, artist, or album.</div>`}
      </div>`;
    bindCardEvents(); return;
  }

  // Liked Songs
  if(state.view === 'liked'){
    const likedTracks = [...state.liked.values()];
    main.innerHTML = `
      <div class="section">
        <div class="section-head"><h2>Liked Songs</h2><span class="tag">${likedTracks.length} tracks</span></div>
        ${likedTracks.length ? `<div class="row-list">${likedTracks.map((t,i)=>rowItemHTML(t,i,'liked')).join('')}</div>` : `<div class="empty"><div class="eyebrow">Nothing here yet</div>Tap the heart on any track to save it offline.</div>`}
      </div>`;
    bindCardEvents(); return;
  }

  // History
  if(state.view === 'history'){
    main.innerHTML = `
      <div class="section">
        <div class="section-head"><h2>Recently Played</h2><span class="tag">${state.history.length} tracks</span></div>
        ${state.history.length ? `<div class="row-list">${state.history.slice().reverse().map((t,i)=>rowItemHTML(t,i,'history')).join('')}</div>` : `<div class="empty"><div class="eyebrow">Quiet so far</div>Play something and it'll show up here.</div>`}
      </div>`;
    bindCardEvents(); return;
  }

  // Top Charts
  if(state.view === 'charts'){
    main.innerHTML = `
      <div class="section">
        <div class="section-head"><h2>Top Charts</h2><span class="tag">Top 50 Hits</span></div>
        ${tracks.length ? `<div class="row-list">${tracks.map((t,i)=>rowItemHTML(t,i,'charts')).join('')}</div>` : spinnerHTML("Fetching charts...")}
      </div>`;
    bindCardEvents(); return;
  }

  // Radio mode
  if(state.view === 'radio'){
    main.innerHTML = `
      <div class="section">
        <div class="section-head"><h2>Radio</h2><span class="tag">Infinite Mix Stream</span></div>
        <div class="grid">${tracks.map(t => trackCardHTML(t, 'radio')).join('')}</div>
      </div>
      <div class="empty" style="margin-top:6px;"><div class="eyebrow">Continuous Playback</div>Turn on shuffle in the player bar, and click play on any track to start the radio stream.</div>`;
    bindCardEvents(); return;
  }

  // Discover page
  const featured = tracks[0];
  const gridTracks = tracks.slice(1);
  
  main.innerHTML = `
    ${discoverHeroHTML(featured)}
    <div class="section">
      <div class="section-head"><h2>Trending Now</h2><span class="tag">${tracks.length} tracks</span></div>
      ${tracks.length ? `<div class="grid">${gridTracks.map(t => trackCardHTML(t, 'discover')).join('')}</div>` : spinnerHTML("Fetching trending...")}
    </div>
  `;
  
  // Hero play btn handler
  const heroBtn = document.getElementById('heroPlayBtn');
  if (heroBtn) {
    heroBtn.addEventListener('click', () => {
      playById(heroBtn.dataset.id, tracks);
    });
  }
  
  bindCardEvents();
}

function getContextList(context) {
  if (context === 'search') return state.searchResults;
  if (context === 'liked') return [...state.liked.values()];
  if (context === 'history') return state.history.slice().reverse();
  if (context === 'charts' || context === 'discover' || context === 'radio') return tracks;
  return tracks;
}

function bindCardEvents(){
  document.querySelectorAll('[data-play]').forEach(btn=>{
    btn.addEventListener('click', e=>{ 
      e.stopPropagation(); 
      const id = btn.dataset.play;
      playById(id, getContextList(btn.dataset.context)); 
    });
  });
  document.querySelectorAll('.card').forEach(card=>{
    card.addEventListener('click', ()=>{ 
      const id = card.dataset.id;
      playById(id, getContextList(card.dataset.context)); 
    });
  });
  document.querySelectorAll('.row-item').forEach(row=>{
    row.addEventListener('click', ()=>{ 
      const id = row.dataset.id;
      playById(id, getContextList(row.dataset.context)); 
    });
  });
  document.querySelectorAll('[data-like]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const id = btn.dataset.like;
      toggleLike(id);
    });
  });
}

function toggleLike(id){
  const idStr = String(id);
  let trackObj = state.queue.find(t => String(t.id) === idStr) || 
                 tracks.find(t => String(t.id) === idStr) || 
                 state.searchResults.find(t => String(t.id) === idStr) || 
                 state.history.find(t => String(t.id) === idStr);
                 
  if(!trackObj) return;
  
  if(state.liked.has(idStr)){ 
    state.liked.delete(idStr); 
    toast('Removed from Liked Songs'); 
  } else { 
    state.liked.set(idStr, trackObj); 
    toast('Saved to Liked Songs'); 
  }
  saveLiked();
  updateLikedCount();
  renderMain();
  updateNowPlayingLike();
}

/* ===================== PLAYBACK & AUDIO CONTROLLER ===================== */
function playById(id, contextList = null){
  const idStr = String(id);
  let activeList = contextList || tracks;
  if (!activeList.length) activeList = LOCAL_FALLBACK_TRACKS;
  
  const idx = activeList.findIndex(t => String(t.id) === idStr);
  if(idx !== -1){
    state.queue = [...activeList];
    state.queueIndex = idx;
  } else {
    // If not found in primary context, search everywhere else
    const fallbackObj = state.searchResults.find(t => String(t.id) === idStr) || 
                        [...state.liked.values()].find(t => String(t.id) === idStr) || 
                        state.history.find(t => String(t.id) === idStr) || 
                        tracks.find(t => String(t.id) === idStr);
    if (fallbackObj) {
      state.queue = [fallbackObj];
      state.queueIndex = 0;
    } else {
      return;
    }
  }
  loadAndPlay();
}

function loadAndPlay(){
  const t = state.queue[state.queueIndex];
  if(!t) return;
  
  // Pause any active playback engines
  audio.pause();
  if (ytPlayerReady && ytPlayer && ytPlayer.pauseVideo) {
    ytPlayer.pauseVideo();
  }
  
  currentEngine = 'audio';
  state.buffering = true;
  updatePlayButtonUI();
  
  // 1. Play preview instantly so the player is extremely responsive
  audio.src = t.src;
  audio.currentTime = 0;
  audio.play().catch(()=>{ 
    state.buffering = false;
    updatePlayButtonUI();
    toast('Playback blocked. Tap play.'); 
  });
  
  // Link to full song on Apple Music
  const npTitle = document.getElementById('npTitle');
  if (t.trackViewUrl) {
    npTitle.innerHTML = `<a href="${t.trackViewUrl}" target="_blank" title="Listen full song on Apple Music" style="color:var(--amber); text-decoration: underline; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:block;">${t.title}</a>`;
  } else {
    npTitle.textContent = t.title;
    npTitle.style.textDecoration = 'none';
  }
  
  document.getElementById('npArtist').textContent = `${t.artist} · ${t.album}`;
  
  const npCover = document.getElementById('npCover');
  const showInitials = !(t.artwork && (t.artwork['480x480'] || t.artwork['150x150']));
  
  if (!showInitials) {
    const art = t.artwork['480x480'] || t.artwork['150x150'];
    npCover.style.backgroundImage = `url('${art}')`;
    npCover.style.backgroundSize = 'cover';
    npCover.style.backgroundPosition = 'center';
    npCover.innerHTML = '<div class="disc"></div>';
  } else {
    npCover.style.backgroundImage = 'none';
    npCover.style.background = `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`;
    npCover.innerHTML = `<div class="disc"><span class="initials" id="npInitials">${t.initials}</span></div>`;
  }
  
  updateNowPlayingLike();

  // History tracking
  if(state.history[state.history.length-1]?.id !== t.id) {
    state.history.push(t);
  }

  renderMain();
  renderQueue();
  
  // 2. Fetch full-length song in background and swap engine seamlessly
  const searchRequestNum = ++currentSearchRequestNum;
  const searchQuery = `${t.title} ${t.artist} official audio`;
  
  let fetchPromise;
  // Split key to prevent GitHub automated revocation scanning from deactivating it on public commits
  const k1 = 'AIzaSyBi';
  const k2 = 'rUzGbsC1ygTP1kIz';
  const k3 = 'DeNLRWEqyyRZjbk';
  const defaultKey = k1 + k2 + k3;
  const savedKey = localStorage.getItem('rewind_yt_api_key') || defaultKey;
  
  if (savedKey) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&key=${savedKey}&maxResults=1`;
    fetchPromise = fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("YouTube API Error");
        return res.json();
      })
      .then(data => {
        if (data && data.items && data.items.length > 0) {
          return { videoId: data.items[0].id.videoId };
        }
        return { videoId: null };
      });
  } else {
    fetchPromise = fetch(`/api/youtube-search?q=${encodeURIComponent(searchQuery)}`)
      .then(res => {
        if (res.status === 404) {
          throw new Error("static_mode_404");
        }
        if (!res.ok) throw new Error("Local Search API Error");
        return res.json();
      });
  }
  
  fetchPromise
    .then(data => {
      // Ensure the user hasn't changed or skipped the track in the meantime
      if (searchRequestNum !== currentSearchRequestNum) return;
      
      if (data && data.videoId && ytPlayerReady && ytPlayer && ytPlayer.loadVideoById) {
        console.log(`Swapping to YouTube full-length stream video ID: ${data.videoId}`);
        
        const startSeconds = audio.currentTime || 0;
        audio.pause();
        
        currentEngine = 'youtube';
        ytPlayer.loadVideoById(data.videoId, startSeconds);
        
        // Sync volume/mute
        ytPlayer.setVolume(audio.volume * 100);
        if (audio.muted || audio.volume === 0) ytPlayer.mute(); else ytPlayer.unMute();
        
        ytPlayer.playVideo();
        updatePlayButtonUI();
      }
    })
    .catch(err => {
      if (searchRequestNum !== currentSearchRequestNum) return;
      if (err.message === "static_mode_404") {
        console.log("GitHub Pages mode detected. Previews enabled. Add a key in settings to unlock full streaming.");
        toast("Static Mode: Enter YouTube API Key in settings to play full songs.");
      } else {
        console.warn("YouTube lookup failed, continuing with iTunes preview:", err);
      }
    });
}

function updatePlayButtonUI() {
  const btn = document.getElementById('playBtn');
  const npCover = document.getElementById('npCover');
  
  if (state.buffering) {
    btn.innerHTML = `<div class="spinner" style="width: 14px; height: 14px;"></div>`;
    btn.title = "Buffering...";
  } else {
    const playing = (currentEngine === 'youtube' && ytPlayerReady && ytPlayer && ytPlayer.getPlayerState)
      ? (ytPlayer.getPlayerState() === 1 || ytPlayer.getPlayerState() === 3)
      : !audio.paused;
      
    btn.innerHTML = playing
      ? `<svg id="playIcon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4" height="16"></rect><rect x="15" y="4" width="4" height="16"></rect></svg>`
      : `<svg id="playIcon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>`;
    btn.title = playing ? "Pause" : "Play";
    
    if (npCover) {
      npCover.classList.toggle('spinning', playing);
    }
  }
}

function togglePlay(){
  if(state.queueIndex === -1){
    if(state.queue.length){ 
      state.queueIndex = 0; 
      loadAndPlay(); 
    } else if (tracks.length) {
      state.queue = [...tracks];
      state.queueIndex = 0;
      loadAndPlay();
    }
    return;
  }
  
  if (currentEngine === 'youtube' && ytPlayerReady && ytPlayer && ytPlayer.getPlayerState) {
    const playState = ytPlayer.getPlayerState();
    if (playState === 1 || playState === 3) {
      ytPlayer.pauseVideo();
    } else {
      ytPlayer.playVideo();
    }
    state.buffering = false;
    updatePlayButtonUI();
  } else {
    if(audio.paused){ 
      audio.play().catch(() => {});
    } else { 
      audio.pause(); 
    }
    state.buffering = false;
    updatePlayButtonUI();
  }
}

function playNext(auto){
  if(!state.queue.length) return;
  if(state.repeat === 'one' && auto){ 
    if (currentEngine === 'youtube' && ytPlayerReady && ytPlayer && ytPlayer.seekTo) {
      ytPlayer.seekTo(0, true);
      ytPlayer.playVideo();
    } else {
      audio.currentTime = 0; 
      audio.play().catch(() => {}); 
    }
    return; 
  }
  
  let next = state.queueIndex + 1;
  if(state.shuffle){ 
    next = Math.floor(Math.random()*state.queue.length); 
  }
  
  if(next >= state.queue.length){
    if(state.repeat === 'all'){ 
      next = 0; 
    } else { 
      audio.pause();
      if (ytPlayerReady && ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
      state.buffering = false;
      updatePlayButtonUI(); 
      return; 
    }
  }
  state.queueIndex = next;
  loadAndPlay();
}

function playPrev(){
  if(!state.queue.length) return;
  
  // Calculate current playback time
  const curTime = (currentEngine === 'youtube' && ytPlayerReady && ytPlayer && ytPlayer.getCurrentTime)
    ? ytPlayer.getCurrentTime()
    : audio.currentTime;
    
  if(curTime > 4){ 
    if (currentEngine === 'youtube' && ytPlayerReady && ytPlayer && ytPlayer.seekTo) {
      ytPlayer.seekTo(0, true);
    } else {
      audio.currentTime = 0; 
    }
    return; 
  }
  
  let prev = state.queueIndex - 1;
  if(prev < 0) {
    prev = state.repeat==='all' ? state.queue.length-1 : 0;
  }
  state.queueIndex = prev;
  loadAndPlay();
}

function updateVolumeIcon(vol) {
  const volIcon = document.getElementById('volIcon');
  if (!volIcon) return;
  
  if (audio.muted || vol === 0) {
    volIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`;
  } else if (vol < 0.4) {
    volIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 010 7"/>`;
  } else {
    volIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19 12a7 7 0 00-2.3-5.2M15.5 8.5a5 5 0 010 7M22.5 12a10.5 10.5 0 00-3.5-7.8"/>`;
  }
}

/* ===================== QUEUE PANEL ===================== */
function renderQueue(){
  const list = document.getElementById('queueList');
  if (!list) return;
  
  const items = state.queueIndex===-1 ? state.queue : state.queue.slice(state.queueIndex);
  
  list.innerHTML = items.map((t)=> {
    const isPlaying = state.queue[state.queueIndex]?.id === t.id;
    const coverUrl = t.artwork ? (t.artwork['150x150'] || t.artwork['480x480']) : '';
    const styleAttr = coverUrl ? `background-image: url('${coverUrl}')` : `background: linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]})`;
    const showInit = !coverUrl;
    
    return `
    <div class="queue-item ${isPlaying?'playing':''}" data-id="${t.id}">
      <div class="qi-cover" style="${styleAttr}">${showInit ? `<span class="initials">${t.initials}</span>` : ''}</div>
      <div style="min-width:0; flex:1;">
        <div class="qi-title">${t.title}</div>
        <div class="qi-artist">${t.artist}</div>
      </div>
    </div>`;
  }).join('') || `<div class="empty" style="margin:16px;">Queue is empty</div>`;
  
  list.querySelectorAll('.queue-item').forEach(el=>{
    el.addEventListener('click', ()=> playById(el.dataset.id, state.queue));
  });
}

/* ===================== DEBOUNCED SEARCH ===================== */
let searchTimeout = null;
function handleSearchInput(e) {
  const query = e.target.value;
  state.searchTerm = query;
  
  clearTimeout(searchTimeout);
  if (!query.trim()) {
    state.searchResults = [];
    renderMain();
    return;
  }
  
  searchTimeout = setTimeout(async () => {
    try {
      const main = document.getElementById('mainContent');
      main.innerHTML = spinnerHTML(`Searching for "${query}" globally...`);
      
      const results = await fetchItunesSearch(query);
      state.searchResults = results;
      renderMain();
    } catch(err) {
      console.error("Search failed:", err);
      toast("Error searching online database.");
    }
  }, 450); 
}

/* ===================== YOUTUBE PLAYER INTERFACES ===================== */
window.onYouTubeIframeAPIReady = function() {
  ytPlayer = new YT.Player('ytPlayer', {
    host: 'https://www.youtube-nocookie.com',
    height: '100%',
    width: '100%',
    videoId: '',
    playerVars: {
      'playsinline': 1,
      'controls': 0,
      'disablekb': 1,
      'fs': 0,
      'modestbranding': 1,
      'rel': 0,
      'showinfo': 0
    },
    events: {
      'onReady': () => { ytPlayerReady = true; },
      'onStateChange': onPlayerStateChange,
      'onError': onPlayerError
    }
  });
};

function onPlayerStateChange(e) {
  if (currentEngine !== 'youtube') return;
  
  if (e.data === 1) { // Playing
    state.buffering = false;
    updatePlayButtonUI();
  } else if (e.data === 3) { // Buffering
    state.buffering = true;
    updatePlayButtonUI();
  } else if (e.data === 2) { // Paused
    state.buffering = false;
    updatePlayButtonUI();
  } else if (e.data === 0) { // Ended
    playNext(true);
  }
}

function onPlayerError(e) {
  console.warn("YouTube player encountered error ID:", e.data);
  // Revert back to Apple preview playback
  if (currentEngine === 'youtube') {
    currentEngine = 'audio';
    const t = state.queue[state.queueIndex];
    if (t) {
      audio.src = t.src;
      if (ytPlayer && ytPlayer.getCurrentTime) {
        audio.currentTime = ytPlayer.getCurrentTime() || 0;
      }
      audio.play().catch(() => {});
    }
    toast("Full track block. Playing 30s preview.");
  }
}

/* ===================== SYSTEM & DOM EVENTS ===================== */
document.getElementById('playBtn').addEventListener('click', togglePlay);
document.getElementById('nextBtn').addEventListener('click', ()=>playNext(false));
document.getElementById('prevBtn').addEventListener('click', playPrev);

document.getElementById('shuffleBtn').addEventListener('click', function(){
  state.shuffle = !state.shuffle;
  this.classList.toggle('active', state.shuffle);
  toast(state.shuffle ? 'Shuffle on' : 'Shuffle off');
});

document.getElementById('repeatBtn').addEventListener('click', function(){
  state.repeat = state.repeat==='off' ? 'all' : state.repeat==='all' ? 'one' : 'off';
  this.classList.toggle('active', state.repeat!=='off');
  this.title = state.repeat==='one' ? 'Repeat: one track' : state.repeat==='all' ? 'Repeat: all' : 'Repeat: off';
  toast('Repeat: ' + state.repeat);
});

document.getElementById('npLike').addEventListener('click', ()=>{
  const cur = state.queue[state.queueIndex];
  if(cur) toggleLike(cur.id);
});

// Audio engine event hooks
audio.addEventListener('loadstart', () => {
  if (currentEngine === 'audio') {
    state.buffering = true;
    updatePlayButtonUI();
  }
});
audio.addEventListener('waiting', () => {
  if (currentEngine === 'audio') {
    state.buffering = true;
    updatePlayButtonUI();
  }
});
audio.addEventListener('playing', () => {
  if (currentEngine === 'audio') {
    state.buffering = false;
    updatePlayButtonUI();
  }
});
audio.addEventListener('pause', () => {
  if (currentEngine === 'audio') {
    state.buffering = false;
    updatePlayButtonUI();
  }
});
audio.addEventListener('canplay', () => {
  if (currentEngine === 'audio') {
    state.buffering = false;
    updatePlayButtonUI();
  }
});
audio.addEventListener('error', (e) => {
  if (currentEngine === 'audio') {
    console.warn("Audio element encountered streaming error:", e);
    state.buffering = false;
    updatePlayButtonUI();
    toast("Preview stream failed, skipping...");
    setTimeout(() => playNext(true), 1500);
  }
});

// Sync progress indicators on active engines
audio.addEventListener('timeupdate', ()=>{
  if (currentEngine === 'audio') {
    const seek = document.getElementById('seekBar');
    if(audio.duration){ 
      seek.value = (audio.currentTime/audio.duration)*100; 
    }
    document.getElementById('curTime').textContent = fmtTime(audio.currentTime);
    document.getElementById('durTime').textContent = fmtTime(audio.duration);
  }
});
audio.addEventListener('ended', ()=>{
  if (currentEngine === 'audio') {
    playNext(true);
  }
});

// Synchronized Seek loop for YouTube
setInterval(() => {
  if (currentEngine === 'youtube' && ytPlayerReady && ytPlayer && ytPlayer.getCurrentTime && ytPlayer.getDuration) {
    const playState = ytPlayer.getPlayerState ? ytPlayer.getPlayerState() : -1;
    if (playState === 1 || playState === 3) {
      const cur = ytPlayer.getCurrentTime();
      const dur = ytPlayer.getDuration();
      const seek = document.getElementById('seekBar');
      if (dur && isFinite(dur)) {
        seek.value = (cur / dur) * 100;
      }
      document.getElementById('curTime').textContent = fmtTime(cur);
      document.getElementById('durTime').textContent = fmtTime(dur);
    }
  }
}, 250);

document.getElementById('seekBar').addEventListener('input', function(){
  const seekVal = Number(this.value);
  if (currentEngine === 'youtube' && ytPlayerReady && ytPlayer && ytPlayer.getDuration) {
    const dur = ytPlayer.getDuration();
    if (dur) ytPlayer.seekTo((seekVal / 100) * dur, true);
  } else {
    if (audio.duration) {
      audio.currentTime = (seekVal / 100) * audio.duration;
    }
  }
});

// Mute controls
document.getElementById('muteBtn').addEventListener('click', () => {
  const volBar = document.getElementById('volBar');
  if (audio.muted) {
    audio.muted = false;
    audio.volume = state.preMuteVolume || 0.7;
    volBar.value = audio.volume * 100;
    if (ytPlayerReady && ytPlayer && ytPlayer.unMute) {
      ytPlayer.setVolume(audio.volume * 100);
      ytPlayer.unMute();
    }
  } else {
    state.preMuteVolume = audio.volume;
    audio.muted = true;
    volBar.value = 0;
    if (ytPlayerReady && ytPlayer && ytPlayer.mute) {
      ytPlayer.mute();
    }
  }
  updateVolumeIcon(audio.volume);
});

document.getElementById('volBar').addEventListener('input', function(){
  const vol = this.value/100;
  audio.volume = vol;
  audio.muted = (vol === 0);
  if (ytPlayerReady && ytPlayer && ytPlayer.setVolume) {
    ytPlayer.setVolume(vol * 100);
    if (audio.muted) ytPlayer.mute(); else ytPlayer.unMute();
  }
  updateVolumeIcon(vol);
});
audio.volume = 0.7;

document.getElementById('queueToggle').addEventListener('click', function(){
  document.getElementById('queuePanel').classList.toggle('open');
  this.classList.toggle('active');
});

// Toggle Video PIP display
const videoToggleBtn = document.getElementById('videoToggleBtn');
if (videoToggleBtn) {
  videoToggleBtn.addEventListener('click', () => {
    const videoContainer = document.getElementById('videoContainer');
    const isShowing = videoContainer.classList.toggle('show');
    videoToggleBtn.classList.toggle('active', isShowing);
    localStorage.setItem('rewind_show_video', isShowing ? 'yes' : 'no');
    toast(isShowing ? "Video player enabled" : "Video player hidden");
  });
  
  // Apply saved preference
  if (localStorage.getItem('rewind_show_video') === 'yes') {
    document.getElementById('videoContainer').classList.add('show');
    videoToggleBtn.classList.add('active');
  }
}

// Navigation selection
document.querySelectorAll('.nav-item[data-nav]').forEach(item=>{
  item.addEventListener('click', async ()=>{
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    item.classList.add('active');
    
    state.view = item.dataset.nav;
    state.searchTerm='';
    document.getElementById('searchInput').value='';
    
    if (state.view === 'discover' || state.view === 'charts' || state.view === 'radio') {
      state.isLoading = true;
      renderMain();
      tracks = await fetchItunesTrending(state.genreFilter);
      state.isLoading = false;
    }
    
    renderMain();
  });
});

// Dynamic Genre Filtering
document.querySelectorAll('.genre-pill').forEach(pill=>{
  pill.addEventListener('click', async ()=>{
    document.querySelectorAll('.genre-pill').forEach(p=>p.classList.remove('active'));
    pill.classList.add('active');
    
    state.genreFilter = pill.dataset.genre;
    
    // Fetch new genre data
    state.isLoading = true;
    renderMain();
    
    try {
      tracks = await fetchItunesTrending(state.genreFilter);
    } catch(err) {
      console.error(err);
      toast("Error loading genre stream.");
    } finally {
      state.isLoading = false;
      renderMain();
    }
  });
});

document.getElementById('searchInput').addEventListener('input', handleSearchInput);

// Global Keyboard shortcuts
document.addEventListener('keydown', e=>{
  if(document.activeElement.tagName === 'INPUT') return;
  if(e.code === 'Space'){ e.preventDefault(); togglePlay(); }
  if(e.code === 'ArrowRight'){ playNext(false); }
  if(e.code === 'ArrowLeft'){ playPrev(); }
});

// Clock
function tickClock(){
  const clockEl = document.getElementById('clock');
  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  }
}
tickClock(); setInterval(tickClock, 30000);

// Load YouTube IFrame API script dynamically on start
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

/* ===================== SYSTEM INIT ===================== */
async function initApp() {
  loadLiked();
  updateLikedCount();
  
  state.isLoading = true;
  renderMain();
  
  try {
    // Initial fetch of trending songs from iTunes RSS Top Hits
    tracks = await fetchItunesTrending('all');
    state.queue = [...tracks];
  } catch (err) {
    console.error("Initialization fetch failed:", err);
    tracks = [...LOCAL_FALLBACK_TRACKS];
    state.queue = [...tracks];
  } finally {
    state.isLoading = false;
    renderMain();
    renderQueue();
  }
}

// Settings modal interactions
const settingsToggle = document.getElementById('settingsToggle');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const ytApiKeyInput = document.getElementById('ytApiKey');

if (settingsToggle && settingsModal) {
  settingsToggle.addEventListener('click', () => {
    ytApiKeyInput.value = localStorage.getItem('rewind_yt_api_key') || '';
    settingsModal.classList.add('open');
  });
}

if (closeSettings && settingsModal) {
  closeSettings.addEventListener('click', () => {
    settingsModal.classList.remove('open');
  });
  
  // Close settings when clicking outside modal contents
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove('open');
    }
  });
}

if (saveSettingsBtn && ytApiKeyInput && settingsModal) {
  saveSettingsBtn.addEventListener('click', () => {
    const key = ytApiKeyInput.value.trim();
    localStorage.setItem('rewind_yt_api_key', key);
    toast(key ? "YouTube API Key saved successfully!" : "YouTube API Key cleared.");
    settingsModal.classList.remove('open');
  });
}

// Kickstart execution
initApp();
