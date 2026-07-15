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

3. **סוג עסק** (Business Type/Category) - *Optional*
   - The business category or sector
   - Example: "מרכז לימודים", "קפה", "משרד עו״ד"

4. **דירוג אינדיקציה** (Suspicion Rating) - *Required - ALWAYS "גבוה"*
   - **This field is mandatory and MUST always be "גבוה"** (High)
   - Do NOT use "בינוני", "לא חשוד", or "דרוש בדיקה"
   - The system requires this value to be present in every row
   - Example: "גבוה"

5. **קישור 1** (Link 1) - *Optional*
   - First source link (URL)
   - Can be any source that mentions the business
   - Example: "https://zips.co.il/עסקים/ירושלים"

6. **קישור 2** (Link 2) - *Optional*
   - Second source link (URL)
   - Example: "https://prog.co.il/threads/אספקט"

7. **קישור 3** (Link 3) - *Optional*
   - Third source link (URL)
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
  - Suspicion Rating = "גבוה" (required)
- Links are optional (leave empty if none)

### Links Handling
- The website can display up to 3 links per business
- Links should be FULL URLs starting with `http://` or `https://`
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

| שם העסק | כתובת | סוג עסק | דירוג אינדיקציה | קישור 1 | קישור 2 | קישור 3 |
|---------|-------|--------|-----------------|---------|---------|---------|
| אספקט לימודי איור | אבא אחימאיר 11, ירושלים | מרכז לימודים | גבוה | https://zips.co.il/עסקים | https://prog.co.il/threads | |
| קפה גורדון | דרך כעגל 5, ירושלים | קפה וברים | גבוה | https://waze.com/go/cafe | https://google.com/maps | https://example.com |
| משרד נ. כהן | הטיבי 2, ירושלים | משרד עו״ד | גבוה | https://linkedin.com/company | | |

---

## Upload Instructions

1. **File Format:** Save as `.xlsx` (Excel format)
2. **File Name:** Any name is fine (e.g., `businesses.xlsx`, `arnona_report.xlsx`)
3. **Upload Method:** Go to https://urbandetective007.github.io/Arnona_Agent/businesses → Upload page
4. **Validation:** The system will:
   - Check for "שם העסק" header
   - Parse all 7 columns
   - Validate that every row has a business name and address
   - Deduplicate by name + address combination

---

## Common Mistakes to Avoid

❌ **Wrong:** Diacritics or spelling variations
- "שם העסק" ✓ | "שם העסק " (extra space) ✗ | "שם עסק" (missing letter) ✗

❌ **Wrong:** Suspicion rating other than "גבוה"
- "גבוה" ✓ | "בינוני" ✗ | "גבוה " (with space) ✗

❌ **Wrong:** Links without http:// or https://
- "https://example.com" ✓ | "example.com" ✗

❌ **Wrong:** Extra columns that break parsing
- Create only the 7 columns above, no more

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
