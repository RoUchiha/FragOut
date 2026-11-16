# FragOut iOS release

## Listing draft

| App Store field | Draft value |
| --- | --- |
| Name | FragOut |
| Subtitle | Fragrance wardrobe & journal |
| Primary category | Lifestyle |
| Primary language | English (U.S.) |
| Bundle ID | `app.fragout.mobile` |
| Marketing version | `0.2.0` |
| SKU | `fragout-ios` |
| Download price | Free |
| Keywords | fragrance,perfume,cologne,collection,layering,wardrobe,scent,outfit,journal |

### Description

Keep your fragrances in one place and find a scent for what you're wearing, how you feel, or the occasion.

- Build a collection by adding bottles or scanning their labels. Review the exact edition before saving.
- Open FragDex for sourced notes, available wear ratings, bottle photos, and affordable alternatives.
- Find a fragrance from your collection for a mood, vibe, or outfit. Take a photo, type your outfit, or dictate it.
- Try layering pairs, save favorites, and keep a journal of what you wore.

Outfit photos are discarded by default. Turn on the private archive to keep only the looks you choose to save. Manage your collection, photos, and account from Settings.

## Notes for App Review

FragOut opens in demo mode with a sample fragrance collection. Use Home to browse the collection and the lightbulb to open **Find a scent**. Search for `tired clean work` to see mood, vibe, and occasion recommendations. In **Match outfit**, type `white shirt, navy trousers, brown loafers`, review the description, confirm it, then choose **Find matches**. To test photography, choose **Take selfie** or **Choose photo** and review the detected clothing before matching a scent.

The default vision model runs on the FragOut server. OpenAI and Claude are optional connections that require the user's API key and approval before a cloud analysis. Review can use the default provider. To test the full collection or account-deletion flow, create a test account through **Settings → Create account / sign in**. **Settings → Delete account** removes its collection, credentials, and archived outfit photos from the active database.

## Production settings

| Area | Release value or action |
| --- | --- |
| API | A reachable HTTPS origin with the production Next.js app, the existing private Supabase database, and working Ollama vision. Set the origin as `EXPO_PUBLIC_API_URL` in the EAS production environment. |
| Support and privacy | Use the production origin's `/support` and `/privacy` pages. Configure a public contact with `FRAGOUT_PRIVACY_CONTACT_EMAIL`. Set `FRAGOUT_SUPPORT_CONTACT_EMAIL` for a separate support address. `/delete-account` is the public deletion guide. |
| Apple account | Register the bundle identifier on the owner's Apple Developer team and create the corresponding iOS app in App Store Connect. Confirm the listing name is available there. |
| Expo | Link the project under the owner's Expo account. Set the assigned Expo project ID in `extra.eas.projectId` in the dynamic app config if EAS asks. The existing `production` profile uses Expo SDK 58 for store distribution. |
| Privacy answers | Verify the actual production settings in App Store Connect. The app stores account name, email, collection, preferences, and other user content. Opt-in archives store photos. A user-selected provider can receive approved inputs. Ads are disabled in the default iOS config. Review the App Privacy answers again if AdMob is enabled. |
| Ratings and availability | Complete Apple's age-rating and export-compliance questions against the production binary. Choose the release territories, pricing, and release timing with the owner. |
| Bottle photos | The catalog credits and links the source of each bundled image. Confirm distribution rights for the 218 packshots before uploading the app. |

Use EAS under the owner's account to build and upload the device binary.

```powershell
cd mobile
npx.cmd eas-cli@27.10.0 login --browser
npx.cmd eas-cli@27.10.0 init
npx.cmd eas-cli@27.10.0 build --platform ios --profile production
```

Run `npx.cmd eas-cli@27.10.0 submit --platform ios --id` with the verified EAS build ID to upload the binary to App Store Connect. Select that build, add the metadata, complete the review information, and submit it in App Store Connect. App Review controls approval. Test front and rear camera capture and speech recognition on a physical iPhone through the signed build. [Expo iOS submission](https://docs.expo.dev/submit/ios/), [Apple submission steps](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app), [App Privacy details](https://developer.apple.com/app-store/app-privacy-details/), [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## Screenshots

Run **iOS acceptance** with `store_screenshots` enabled. The workflow captures the collection, scent search, and outfit screen directly from the signed simulator build using fictional demo data. The `ios-simulator-evidence/store-screenshots` artifact contains the iPhone 6.3-inch and iPad 13-inch images at native resolution. [Apple screenshot sizes](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)

The 16 November capture passed and verified all six PNGs. iPhone images are 1206 × 2622. iPad images are 2064 × 2752. [Passing screenshot run](https://github.com/RoUchiha/FragOut/actions/runs/43813360516)
