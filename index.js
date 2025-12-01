// Modern movie search using OMDb (http://www.omdbapi.com/)
// The user-provided API key is set below. If you want to change it, edit this value.
const OMDB_API_KEY = '22f52359';

const el = {
  searchInput: document.getElementById('searchInput'),
  results: document.getElementById('results'),
  loading: document.getElementById('loading'),
  modal: document.getElementById('modal'),
  modalDialog: document.getElementById('modalDialog'),
  modalContent: document.getElementById('modalContent'),
  modalClose: document.getElementById('modalClose'),
  modalBackdrop: document.getElementById('modalBackdrop'),
  clearBtn: document.getElementById('clearBtn')
};
// filter controls
el.sortSelect = document.getElementById('sortSelect');
el.yearFrom = document.getElementById('yearFrom');
el.yearTo = document.getElementById('yearTo');
el.minRating = document.getElementById('minRating');
el.applyFilters = document.getElementById('applyFilters');
el.clearFilters = document.getElementById('clearFilters');

let controller = null; // for aborting previous fetch
let lastSearchItems = []; // store last search results
const detailsCache = {}; // imdbID -> details

function showLoading(show){
  if(el.loading) el.loading.hidden = !show;
}

function debounce(fn, wait=300){
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}

async function searchMovies(query){
  if(!query || query.trim().length < 2) {
    el.results.innerHTML = '';
    return;
  }

  if(!OMDB_API_KEY){
    el.results.innerHTML = `<div style="color: #ffb4b4;">No OMDb API key set in <code>index.js</code>. Add your key to enable search.</div>`;
    return;
  }

  // Abort previous
  if(controller) controller.abort();
  controller = new AbortController();

  showLoading(true);
  try{
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(query)}&type=movie&page=1`;
    const res = await fetch(url, {signal: controller.signal});
    if(!res.ok) throw new Error('Search failed');
    const data = await res.json();
    if(data.Response === 'True'){
      lastSearchItems = data.Search || [];
      applyFiltersAndRender();
    } else {
      el.results.innerHTML = `<div class="empty">${escapeHtml(data.Error || 'No results')}</div>`;
    }
  }catch(err){
    if(err.name !== 'AbortError'){
      console.error(err);
      el.results.innerHTML = `<div style="color:#f7b4b4">Search error — check console.</div>`;
    }
  }finally{
    showLoading(false);
  }
}

function renderResults(items){
  if(!items || items.length === 0){
    el.results.innerHTML = `<div class="empty">No results found.</div>`;
    return;
  }
  el.results.innerHTML = items.map(i => {
    const poster = i.Poster && i.Poster !== 'N/A' ? i.Poster : 'https://via.placeholder.com/500x750?text=No+Image';
    const year = i.Year ? `${i.Year}` : '';
    return `
      <article class="card" data-id="${i.imdbID}" tabindex="0">
        <img class="poster" src="${poster}" alt="${escapeHtml(i.Title)} poster" />
        <div class="info">
          <div class="genre" data-id="genre-${i.imdbID}"></div>
          <div class="year">${escapeHtml(year)}</div>
          <div class="rating" data-id="rating-${i.imdbID}"></div>
          <div class="title">${escapeHtml(i.Title)}</div>
        </div>
      </article>
    `;
  }).join('');

  // attach click handlers
  el.results.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openDetails(card.dataset.id));
    card.addEventListener('keypress', (e) => { if(e.key === 'Enter') openDetails(card.dataset.id); });
    // fetch and populate extra details (genre, rating) for each card
    fetchAndFillCardDetails(card.dataset.id, card).catch(err => console.debug('card details skipped', err));
  });
}

function parseYearValue(yearStr){
  if(!yearStr) return null;
  const m = yearStr.match(/\d{4}/);
  return m ? parseInt(m[0],10) : null;
}

function matchesYearFilter(item, from, to){
  const y = parseYearValue(item.Year);
  if(!y) return false;
  if(from && y < from) return false;
  if(to && y > to) return false;
  return true;
}

function matchesRatingFilter(item, minRating){
  // check cache first
  const d = detailsCache[item.imdbID];
  if(d && d.imdbRating && d.imdbRating !== 'N/A'){
    const val = parseFloat(d.imdbRating);
    return val >= minRating;
  }
  // if we don't have rating yet, treat as pass and fetch details in background
  fetchAndCacheDetails(item.imdbID).then(()=> applyFiltersAndRender()).catch(()=>{});
  return true;
}

function applyFiltersAndRender(){
  const sort = el.sortSelect?.value || 'title-asc';
  const from = el.yearFrom?.value ? parseInt(el.yearFrom.value,10) : null;
  const to = el.yearTo?.value ? parseInt(el.yearTo.value,10) : null;
  const minRating = el.minRating?.value ? parseFloat(el.minRating.value) : 0;

  let items = Array.from(lastSearchItems || []);
  // filter by year
  if(from || to){
    items = items.filter(i => matchesYearFilter(i, from, to));
  }
  // filter by rating (may re-apply once details cached)
  if(minRating > 0){
    items = items.filter(i => matchesRatingFilter(i, minRating));
  }

  // sort
  items.sort((a,b) => {
    const ta = (a.Title||'').toLowerCase();
    const tb = (b.Title||'').toLowerCase();
    if(sort === 'title-asc') return ta < tb ? -1 : ta > tb ? 1 : 0;
    return ta > tb ? -1 : ta < tb ? 1 : 0;
  });

  renderResults(items);
}

async function fetchAndCacheDetails(imdbID){
  if(!imdbID) return null;
  if(detailsCache[imdbID]) return detailsCache[imdbID];
  try{
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbID}&plot=short`;
    const res = await fetch(url);
    if(!res.ok) return null;
    const d = await res.json();
    if(d.Response === 'True'){
      detailsCache[imdbID] = d;
      return d;
    }
  }catch(e){ }
  return null;
}

async function fetchAndFillCardDetails(imdbID, card){
  if(!imdbID) return;
  try{
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbID}&plot=short`;
    const res = await fetch(url);
    if(!res.ok) return;
    const d = await res.json();
    if(d.Response !== 'True') return;
    const genreEl = card.querySelector('.genre');
    const ratingEl = card.querySelector('.rating');
    const yearEl = card.querySelector('.year');
    if(genreEl) genreEl.textContent = d.Genre && d.Genre !== 'N/A' ? d.Genre.split(',').slice(0,2).join(', ') : '';
    if(ratingEl) ratingEl.textContent = d.imdbRating && d.imdbRating !== 'N/A' ? `★ ${d.imdbRating}` : '';
    if(yearEl) yearEl.textContent = d.Year || yearEl.textContent;
  }catch(err){
    // ignore per-card errors
  }
}

function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

async function openDetails(id){
  if(!id) return;
  if(!OMDB_API_KEY){
    alert('No OMDb API key set in index.js');
    return;
  }

  showLoading(true);
  try{
    const url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${id}&plot=full`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('Details fetch failed');
    const d = await res.json();
    if(d.Response === 'True') renderModal(d);
    else throw new Error(d.Error || 'Details error');
  }catch(err){
    console.error(err);
    alert('Failed to fetch details — see console');
  }finally{
    showLoading(false);
  }
}

function renderModal(d){
  const poster = d.Poster && d.Poster !== 'N/A' ? d.Poster : 'https://via.placeholder.com/500x750?text=No+Image';
  el.modalContent.innerHTML = `
    <div class="modal-body">
      <img class="modal-poster" src="${poster}" alt="${escapeHtml(d.Title)} poster" />
      <div>
        <div class="modal-title">${escapeHtml(d.Title)} <span class="year">${d.Year?d.Year:''}</span></div>
        <div class="modal-overview">${escapeHtml(d.Plot || 'No description available.')}</div>
        <p style="margin-top:12px;color:var(--muted)"><strong>Rating:</strong> ${d.imdbRating || 'N/A'} • <strong>Runtime:</strong> ${d.Runtime || 'N/A'}</p>
        <p style="margin-top:6px;color:var(--muted)"><strong>Genre:</strong> ${escapeHtml(d.Genre || 'N/A')}</p>
      </div>
    </div>
  `;
  // open modal
  openModal();
}

function openModal(){
  el.modal.setAttribute('open', '');
  el.modal.style.display = 'flex';
  el.modalDialog.showModal?.();
  el.modal.setAttribute('aria-hidden', 'false');
}

function closeModal(){
  el.modal.removeAttribute('open');
  el.modal.style.display = 'none';
  try{ el.modalDialog.close(); }catch(e){}
  el.modal.setAttribute('aria-hidden', 'true');
}

// filter panel elements
el.filterToggle = document.getElementById('filterToggle');
el.filterPanel = document.getElementById('filterPanel');
el.sortSelect = document.getElementById('sortSelect');
el.yearFrom = document.getElementById('yearFrom');
el.yearTo = document.getElementById('yearTo');
el.minRating = document.getElementById('minRating');
el.applyFilters = document.getElementById('applyFilters');
el.clearFilters = document.getElementById('clearFilters');

// open / close helpers
function closeFilterPanel(){
  if(!el.filterPanel) return;
  el.filterPanel.classList.remove('open');
  el.filterPanel.setAttribute('aria-hidden','true');
  if(el.filterToggle) el.filterToggle.setAttribute('aria-expanded','false');
}
function openFilterPanel(){
  if(!el.filterPanel) return;
  el.filterPanel.classList.add('open');
  el.filterPanel.setAttribute('aria-hidden','false');
  if(el.filterToggle) el.filterToggle.setAttribute('aria-expanded','true');
}

// attach handlers
el.searchInput?.addEventListener('input', debounce((e)=> searchMovies(e.target.value), 350));
el.clearBtn?.addEventListener('click', ()=>{ el.searchInput.value=''; el.results.innerHTML=''; el.searchInput.focus(); });
el.modalClose?.addEventListener('click', closeModal);
el.modalBackdrop?.addEventListener('click', closeModal);
document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeModal(); });

// Toggle button
el.filterToggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = el.filterPanel?.classList.toggle('open');
  if(isOpen){
    el.filterPanel.setAttribute('aria-hidden','false');
    el.filterToggle.setAttribute('aria-expanded','true');
  } else {
    el.filterPanel.setAttribute('aria-hidden','true');
    el.filterToggle.setAttribute('aria-expanded','false');
  }
});

// prevent clicks inside panel from closing
el.filterPanel?.addEventListener('click', (e) => e.stopPropagation());

// Close panel when clicking outside
document.addEventListener('click', (e) => {
  if(el.filterPanel && el.filterPanel.classList.contains('open')){
    const inside = el.filterPanel.contains(e.target) || el.filterToggle === e.target;
    if(!inside) closeFilterPanel();
  }
});

// Apply / Clear wiring
el.applyFilters?.addEventListener('click', () => {
  applyFiltersAndRender();
  closeFilterPanel();
});

el.clearFilters?.addEventListener('click', () => {
  if(el.sortSelect) el.sortSelect.value = 'title-asc';
  if(el.yearFrom) el.yearFrom.value = '';
  if(el.yearTo) el.yearTo.value = '';
  if(el.minRating) el.minRating.value = '0';
  applyFiltersAndRender();
  closeFilterPanel();
});

// small init: focus search
setTimeout(()=>{ el.searchInput?.focus(); }, 300);


