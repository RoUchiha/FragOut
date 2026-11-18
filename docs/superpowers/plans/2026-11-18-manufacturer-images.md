# Manufacturer image fallback

User instruction: after Parfumo, check the official manufacturer site for the same clear, straight-on bottle photos.

- [x] Test official-product identity, concentration, gallery filtering, fixed source/CDN boundaries, image decoding and source order.
- [x] Add a manufacturer provider using the catalog's reviewed official links and approved brand storefronts. Prefer isolated front/front-angle bottles; reject packaging, top/back views and lifestyle scenes. Preserve Parfumo first and retailers last.
- [x] Refresh eligible retailer thumbnails from verified official photos without replacing Parfumo images or admin overrides. Preserve image credits and source URLs.
- [x] Run unit, asset and live HTTP checks; rebuild the private preview. Publish the verified source with this change.

Requests contain only public fragrance identity, omit credentials, use bounded same-brand redirects and cache normalized JPEGs through FragOut. Uncertain or unavailable official sources fall through to existing retailers. Native clients receive these source/image updates through the shared backend.
