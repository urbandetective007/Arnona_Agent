# Excel File Format Specification

## Overview
When generating Excel files for the Arnona Agent business investigation system, you **MUST** follow this exact format. Any deviation will cause the website to fail parsing the data.

---

## Required Columns

Your Excel file **MUST** have these columns in this order:

1. **שם העסק** (Business Name) - *Required*
   - The official or common name of the business
   - Example: "אספקט לימודי איור"

2. **כתובת** (Address) - *Required*
   - The physical address of the business location
   - Example: "אבא אחימאיר 11, ירושלים"

3. **שכונה** (Neighborhood) - *Optional*
   - The Jerusalem neighborhood the business is located in, if known
   - **MUST be chosen from the closed list in `data/jerusalem_neighborhoods.json`** (the `neighborhoods` array in that file) — do NOT invent a new name or write a variant/combined spelling
   - Example: "בית וגן", "נווה יעקב", "רחביה"
   - Leave empty if unknown or if no entry in the list confidently matches — do not guess

4. **סוג עסק** (Business Type/Category) - *Optional*
   - The business category or sector
   - **Prefer a type from the closed list** in the Supabase table `business_types` — e.g. "משרד עורכי דין", "מרפאת שיניים", "מסעדות, בתי קפה וקייטרינג"
   - Known variants (e.g. "עורכי דין") are rewritten to their list entry on insert (table `business_type_aliases`). A genuinely new type is kept as written and added to the list automatically, marked as brought by the agent, and the employees see it under "סוגי עסק חדשים" — so only use a new type when no list entry fits

5. **דירוג אינדיקציה** (Suspicion Rating) - *Required - "גבוה" or "דרוש בדיקה"*
   - **"גבוה"** only when the address on the business's page is a **full match** for the municipal address: the same street words (in any order, after dropping "רח'", ", ירושלים", hyphens and quotes) **and** the same house number
   - **"דרוש בדיקה"** in every other case — e.g. the page says "מאה שערים 5" and the municipal address is "ב אונגר מאה שערים 5" (a different street: בתי אונגרין), a missing/extra word, or a social-network page that couldn't be opened to verify
   - Do NOT use "בינוני" or "לא חשוד"
   - Example: "גבוה"

6. **קישור 1** (Link 1) - *Optional*
   - First source link: the full URL, a space, and **in parentheses the address as written on that page**
   - Can be any source that mentions the business (directories, Facebook/Instagram, Google Maps, the business's own site)
   - Example: "https://www.d.co.il/80218901/41760/ (מאה שערים 5, ירושלים)"

7. **קישור 2** (Link 2) - *Optional*
   - Second source link, same format
   - Example: "https://www.facebook.com/example (אבא אחימאיר 11, ירושלים)"

8. **קישור 3** (Link 3) - *Optional*
   - Third source link, same format
   - Leave empty if not available

---

## Format Rules

### Column Headers
- **EXACT MATCH REQUIRED** - The system searches for these exact Hebrew names
- Headers must be in row 1
- No typos or variations allowed

### Data Rows
- Start data in row 2
- Each row = one business
- **All rows MUST have:**
  - Business Name (required)
  - Address (required)
  - Suspicion Rating = "גבוה" or "דרוש בדיקה" (required)
- Links are optional (leave empty if none)

### Links Handling
- The website can display up to 3 links per business
- Links should be FULL URLs starting with `http://` or `https://`, followed by a space and the page's address in parentheses
- The website shows that address next to the link, and highlights it when it doesn't match the business's address
- Multiple links are displayed as a vertical list, each on its own line
- If a link is invalid or empty, it is simply not displayed

### No Extra Columns
- Do NOT include any columns not listed above
- Do NOT add columns for:
  - "כתובת תואמת" (matched address)
  - "פירוט האינדיקציה" (suspicion detail)
  - "סיבת אי-אינדיקציה" (reason for no suspicion)
  - "מספר יחידות" (unit count)
  - "בעלי נכסים" (property owners)
  
These fields are not parsed from the Excel file.

---

## Example Excel Structure

| שם העסק | כתובת | שכונה | סוג עסק | דירוג אינדיקציה | קישור 1 | קישור 2 | קישור 3 |
|---------|-------|-------|--------|-----------------|---------|---------|---------|
| אספקט לימודי איור | אבא אחימאיר 11 | קטמון | מרכז לימודים | גבוה | https://zips.co.il/aspect (אבא אחימאיר 11, ירושלים) | https://www.facebook.com/aspect (אבא אחימאיר 11 ירושלים) | |
| מלאכת מחשבת | ב אונגר מאה שערים 5 | מאה שערים | חנות / מסחר קמעונאי | דרוש בדיקה | https://www.d.co.il/21681770/10160/ (מאה שערים 5, ירושלים) | | |

---

## Upload Instructions

1. **File Format:** Save as `.xlsx` (Excel format)
2. **File Name:** Any name is fine (e.g., `businesses.xlsx`, `arnona_report.xlsx`)
3. **Upload Method:** Go to https://urbandetective007.github.io/Arnona_Agent/businesses → Upload page
4. **Validation:** The system will:
   - Check for "שם העסק" header
   - Parse all 8 columns
   - Validate that every row has a business name and address
   - Deduplicate by name + address combination

---

## Common Mistakes to Avoid

❌ **Wrong:** Diacritics or spelling variations
- "שם העסק" ✓ | "שם העסק " (extra space) ✗ | "שם עסק" (missing letter) ✗

❌ **Wrong:** Suspicion rating other than "גבוה" / "דרוש בדיקה", or "גבוה" without a full address match
- "גבוה" ✓ | "דרוש בדיקה" ✓ | "בינוני" ✗ | "גבוה " (with space) ✗

❌ **Wrong:** Links without http:// or https://
- "https://example.com (הלל 5, ירושלים)" ✓ | "example.com" ✗

❌ **Wrong:** Extra columns that break parsing
- Create only the 8 columns above, no more

❌ **Wrong:** Blank rows in the middle
- The system stops parsing when it hits an empty row

---

## Troubleshooting

**Q: "The website shows only one link, but I added three"**
A: The website now displays all 3 links correctly, each on its own line in the expanded view. Make sure you use column names "קישור 1", "קישור 2", "קישור 3" exactly.

**Q: "The business doesn't appear on the website"**
A: Check:
1. File was uploaded successfully (green message)
2. Business name and address are not duplicates of existing entries
3. All required fields have values (name, address, rating)

**Q: "How do I update a business I already uploaded?"**
A: Delete the old entry from the website, then re-upload with the corrected data.

---

## File Size & Performance

- Recommended: Up to 500 businesses per file
- Maximum: 1000 businesses (beyond this, performance may degrade)
- If you have more, split into multiple files and upload separately
