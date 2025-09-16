// Mission4.js (corrected map handling + geocoding)

// ---------- VARIABLES ----------
let currentPage = 0; // Current page index
const pages = document.querySelectorAll('.page'); // select all sections/pages

let sharedReport = false; // flag to track user shares contact details
let selectedIssue = ''; // selected issue type

// Map related
let map = null;
let marker = null;
let mapInitialized = false;
const LOCATION_PAGE_INDEX = 3; // page-order: 0=home,1=issue-type,2=details,3=location,4=contact,5=confirmation

// ---------- Page Navigation Functions ----------
function showPage(index) {
  pages.forEach((page, i) => {
    if (i === index) page.classList.add('active');
    else page.classList.remove('active');
  });

  // If Location page becomes visible, initialize the map (or invalidate size)
  if (index === LOCATION_PAGE_INDEX) {
    // small timeout so the page becomes visible before initializing (helps with CSS rendering)
    if (!mapInitialized) {
      setTimeout(() => {
        initMap();
        mapInitialized = true;
      }, 60);
    } else {
      // map already created: tell Leaflet to recalc size after the container becomes visible
      setTimeout(() => {
        if (map && typeof map.invalidateSize === 'function') {
          map.invalidateSize();
        }
      }, 100);
    }
  }
}

// Next / Prev
function nextPage() {
  if (currentPage < pages.length - 1) {
    currentPage++;
    showPage(currentPage);
  }
}
function prevPage() {
  if (currentPage > 0) {
    currentPage--;
    showPage(currentPage);
  }
}

// Initialize page display
showPage(currentPage);

// ---------- Issue Selection ----------
function selectIssue(issue) {
  selectedIssue = issue;
  nextPage();
}

// ---------- Map Functions ----------
function initMap() {
  // ensure Leaflet (L) exists
  if (typeof L === 'undefined') {
    console.error('Leaflet library not loaded. Make sure <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script> is included.');
    return;
  }

  // if map already exists, don't recreate
  if (map) {
    map.invalidateSize();
    return;
  }

  // create the map centered on Wellington (example)
  map = L.map('map').setView([-41.2865, 174.7762], 13);

  // add tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  // add a default marker
  marker = L.marker([-41.2865, 174.7762]).addTo(map)
    .bindPopup('Default Location')
    .openPopup();

  // clicking the map places/moves the marker and updates the address input with lat,lng
  map.on('click', function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    if (marker) {
      marker.setLatLng([lat, lng]).bindPopup(`Selected: ${lat.toFixed(5)}, ${lng.toFixed(5)}`).openPopup();
    } else {
      marker = L.marker([lat, lng]).addTo(map).bindPopup(`Selected: ${lat.toFixed(5)}, ${lng.toFixed(5)}`).openPopup();
    }
    const addrInput = document.getElementById('address-input');
    if (addrInput) addrInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  });
}

// Find address using Nominatim (OpenStreetMap)
async function findAddress() {
  const address = (document.getElementById('address-input') || {value:''}).value.trim();
  if (!address) {
    alert('Please enter an address or coordinates.');
    return;
  }

  // If address looks like "lat, lng" (coordinates), handle directly
  const coordMatch = address.match(/^\s*([+-]?\d+(\.\d+)?)\s*,\s*([+-]?\d+(\.\d+)?)\s*$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[3]);
    if (!mapInitialized) {
      // ensure map is initialized first (show page)
      showPage(LOCATION_PAGE_INDEX);
    }
    if (map) {
      map.setView([lat, lon], 16);
      if (marker) marker.setLatLng([lat, lon]).bindPopup(`Coordinates: ${lat}, ${lon}`).openPopup();
      else marker = L.marker([lat, lon]).addTo(map).bindPopup(`Coordinates: ${lat}, ${lon}`).openPopup();
    }
    return;
  }

  // Otherwise call Nominatim geocoding
  try {
    // show quick feedback
    // alert("Searching for address: " + address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        // Nominatim asks that you include a proper User-Agent in production. For local testing, this is usually fine.
      }
    });
    const data = await res.json();
    if (!data || data.length === 0) {
      alert('Address not found. Try a different query.');
      return;
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (!mapInitialized) {
      showPage(LOCATION_PAGE_INDEX);
    }
    if (map) {
      map.setView([lat, lon], 16);
      const displayName = data[0].display_name || address;
      if (marker) marker.setLatLng([lat, lon]).bindPopup(displayName).openPopup();
      else marker = L.marker([lat, lon]).addTo(map).bindPopup(displayName).openPopup();
    }
  } catch (err) {
    console.error('Geocoding error', err);
    alert('Error finding address. See console for details.');
  }
}

// ---------- Report Submission ----------
function reportAnonymous() {
  sharedReport = false;
  showPage(5);
  const refCont = document.getElementById('reference-container');
  if (refCont) refCont.style.display = 'none';
}
function shareDetails() {
  sharedReport = true;
  const form = document.getElementById('contact-form');
  if (form) form.style.display = 'block';
}
function submitReport() {
  const name = (document.getElementById('name') || {value:''}).value;
  const email = (document.getElementById('email') || {value:''}).value;
  if (name && email) {
    showPage(5);
    if (sharedReport) {
      const ref = generateReference();
      const el = document.getElementById('reference-number');
      if (el) el.innerText = ref;
      const refCont = document.getElementById('reference-container');
      if (refCont) refCont.style.display = 'block';
    } else {
      const refCont = document.getElementById('reference-container');
      if (refCont) refCont.style.display = 'none';
    }
  } else {
    alert('Please fill name and email.');
  }
}

// ---------- Utility ----------
function generateReference() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = '';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
}
