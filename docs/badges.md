# Badges

## Updating the badges

The README badges are TF2 item-tooltip style SVGs in `docs/badges/`, made by `scripts/make-badges.py`. The script reads the game fonts in `public/ui/fonts` (WOFF2, which needs brotli to decode), downloads the icons from Simple Icons through cdn.jsdelivr.net, and needs fonttools and brotli:

```sh
python -m pip install fonttools brotli
python scripts/make-badges.py
```

To add a badge, add a row to `BADGES` in the script (file name, icon slug, icon color, label, name, and an optional backing color for logos with cut-outs), then add the matching `<img>` to the README.
