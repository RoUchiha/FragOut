# Fragrance catalog

Checked November 7, 2026. The compiled snapshot contains 67 exact releases. Sixty-six have corroborated notes, six have reference photographs, and two have comparable wear reports. Seventeen releases have direct house references.

The app compares the saved house, release and concentration with this snapshot on the FragOut server. The lookup sends zero requests to outside services. It serves licensed catalog photography from a dedicated static directory. Saved bottles and their profile lookups require the owner's session. Label scans and personal observations follow their existing private flows.

## Evidence

- The compiler retains note names found in two or more source records for the same edition. It standardizes selected synonyms at the shared level of detail. A note gets a top, heart or base label when two references agree on the stage and every published placement agrees. Otherwise it appears in the general notes list.
- For Green Irish Tweed EDP and Naxos EDP, the profile shows the two wear estimates side by side. MySecretCart compiles typical wear from published information and wearer reports. Gouttes Rares publishes in-house ranges and uses its sillage field for assessed throw. Different wear methods and scales keep their own labels. Oud for Greatness was held out of the performance comparison because the Gouttes listing and the house use different concentration descriptions.
- Official pages corroborate short note names and exact identity. Parfumo links open the exact edition as a community reference. Publisher ratings, review text and product photography remain on those sites unless the specific item has reuse permission.

## Data and permissions

| Source | Permission and use | Files |
| --- | --- | --- |
| Scento Perfume Database | CC BY 4.0. Selected note names and release facts are standardized and filtered by agreement. Each record links to the publisher's exact page. | [Dataset and terms](https://github.com/Scento-com/perfume-dataset) · [JSONL](https://raw.githubusercontent.com/Scento-com/perfume-dataset/main/perfumes.jsonl) |
| MySecretCart Fragrance Study | CC BY 4.0. Selected note names and wear estimates are standardized and reformatted. | [Study and reuse terms](https://mysecretcart.com/fragrance-study) · [CSV](https://mysecretcart.com/data/fragrance-database.csv) |
| Gouttes Rares Longevity & Sillage Index, 2026 | CC BY 4.0. Two individually matched release records support the side-by-side wear estimates. | [Index and reuse terms](https://gouttesrares.com/pages/fragrance-longevity-sillage-index) · [September 24 JSON](https://cdn.shopify.com/s/files/1/0937/0340/5861/files/gouttes-rares-longevity-sillage-index-2026-09-24.json) |
| Manufacturer and community pages | Direct links checked for the named release. The reviewed file identifies these pages. | [Reviewed release references](reviewed.json) |

[Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)

## Photo credits

The photos are resized JPEGs with camera metadata removed. Edition checks compare the photo's label or documented bottle design with the exact house product page. Photos represent the catalog release. Size and packaging may vary.

| Release | Credit and source | License |
| --- | --- | --- |
| Calvin Klein Euphoria EDP | ggjsmith, edited by Bruce The Deus. [Commons file](https://commons.wikimedia.org/wiki/File:CK_Euphoria_Bottle.jpg) | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/) |
| Chanel No. 5 EDP | Arz. [Commons file](https://commons.wikimedia.org/wiki/File:CHANEL_No5_parfum.jpg) | Public domain |
| Dior Sauvage EDP | Farhan Chohan. [Unsplash photo](https://unsplash.com/photos/a-bottle-of-dior-sauvage-eau-de-parfum-bgrM9NxKLRQ) | [Unsplash License](https://unsplash.com/license) |
| Jean Paul Gaultier Ultra Male EDT Intense | Amin. [Commons file](https://commons.wikimedia.org/wiki/File:Jean-Paul_Gaultier_Ultra_Male.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Le Labo Santal 33 EDP | The Honest Channel, using the credited Commons crop. [Commons file](https://commons.wikimedia.org/wiki/File:Le_Labo_Santal_33_in_a_50_milliliter_bottle_(cropped).jpg) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| Rabanne 1 Million EDT | Jacek Halicki. [Commons file](https://commons.wikimedia.org/wiki/File:2023_Woda_toaletowa_Paco_Rabanne_1_Million.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

## Refreshing the snapshot

Download the three licensed data files from the table to a scratch directory. Review changes to source rights, scope and exact editions before regenerating the catalog. For any new photo, review the photographer's license, check the release against the official page, and add the resized file and credit to the reviewed release. The catalog key aliases cover documented label spellings. Keep distinct releases separate.

```powershell
python scripts/build-fragrance-catalog.py PATH_TO_SCENTO_JSONL PATH_TO_MSC_CSV PATH_TO_GOUTTES_JSON --checked-at YYYY-MM-DD
node --experimental-strip-types --test tests/catalog.test.ts tests/route-security.test.ts
```

Snapshot input SHA-256 digests in the same order as the command above.

```text
695d9e7b5a61bb482ab84e04ae82806ca684bd26fab95b2c8e2931b6d561dfe2
acb8ce0442982cea4ed097bb3c36e228bf901809319960465f7487cfab2aca33
8b0e1c44252594f98b58fe98a964e3ae6ea53dc8ec043f9941abba5955909c74
```
