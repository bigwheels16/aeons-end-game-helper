# Agent Notes

## Security model
- The app runs entirely in the user's own browser, with no data shared between users. The one exception is photo scanning in the Supply Scanner: it uploads the photo to the scanner service (`/api/scan`, behind the oauth2-proxy login under `/oauth2/`), which is served on the same host.
- The bundled dataset (`data/scraped/aeons_end_all.json`) is trusted. HTML sanitizing and the `aeonsend.wiki.gg` link restriction happen once, in the scraper, when the data is scraped; the app does not re-check them.
- Browser storage and the dataset can only be changed by the user, and changes only affect that user. Do not add checks against tampering, cheating or hand-editing (size caps, prototype-pollution guards, runtime re-sanitizing).
- Keep the app usable with malformed data: skip bad entries, or wiping saved state when necessary.
