# Gallery videos

The gallery page (`#/gallery`) shows a grid of 10 videos.

Drop your files in this folder using these exact names and they appear
automatically — no code changes needed:

```
public/videos/1.mp4
public/videos/2.mp4
...
public/videos/10.mp4
```

Until a file exists, its tile renders a soft placeholder (dashed film icon)
so the page never looks broken, and the player skips over it.

## Notes

- Any browser-friendly format works (`.mp4` with H.264 + AAC is the safest).
  If you use a different extension, update the `src` values in
  `src/galleryVideos.js`.
- Optional thumbnails: add a `poster` field per video in
  `src/galleryVideos.js`, e.g. `poster: "/videos/posters/1.jpg"`.
  Without a poster, the browser paints the video's first frame.
- Titles shown on each tile also live in `src/galleryVideos.js`.
- Keep the files reasonably small — they are served straight from the site.
