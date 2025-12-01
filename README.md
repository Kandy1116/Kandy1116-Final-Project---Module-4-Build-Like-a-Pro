# MovieSearch — Modern Movie Search UI


This is a small static site that provides a modern movie search UI using the OMDb API (http://www.omdbapi.com/).

Getting started

- The project is preconfigured to use an OMDb API key. The current key is set in `index.js`.
- If you want to use a different key, open `index.js` and set `const OMDB_API_KEY = 'YOUR_KEY'`.

Run locally (Live Server recommended)

Using VS Code Live Server (recommended):

1. Install the Live Server extension (Ritwick Dey) if you don't already have it.
2. Open the project folder in VS Code.
3. Open `index.html` and click "Go Live" (bottom-right) or use Command Palette → "Live Server: Open with Live Server".

Using Python (alternative):

```powershell
cd "c:\Users\venus\OneDrive\Desktop\KL -Final-Project-Module-4-Build-Like-a-Pro"
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

Notes

- The app queries OMDb for search and for full movie details. Posters come from OMDb's `Poster` field.
- The default API key is stored in `index.js`. If you plan to publish the repo publicly, consider moving the key to a server-side proxy to avoid exposing it.
- If you see errors in the browser console, open DevTools → Console and share the messages if you want help debugging.
