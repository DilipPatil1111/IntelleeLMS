# Program taxonomy & institution profile — requirements

**Date:** April 5, 2026  
**Status:** Implemented  

## Program domain, category, type

- Principals manage three configurable lists:
  - **Program domain** (e.g. Software, Healthcare)
  - **Program category** (e.g. Vocational, Non-vocational)
  - **Program type** (e.g. Diploma, Post Graduate Diploma, Certificate, Short term)
- Each row has a system **id** (cuid) and optional **Customer ID** for external/reference use. When Customer ID is set, it must be **unique within that list** (multiple rows may omit it).
- **Programs** optionally link to one domain, one category, and one type (`Program.programDomainId`, `programCategoryId`, `programTypeId`). Existing programs work unchanged with all nulls.
- **Students** see taxonomy on **Apply** when a program is selected; taxonomy is stored on the **program** and copied to **ProgramApplication** when the student submits (snapshot for reporting/history).
- **Principal-created students** with a program get the same snapshot on the created `ProgramApplication`. **Sync** of missing applications copies taxonomy from the current program row.

## Institution profile

- Single institutional record (`InstitutionProfile`, id = 1): institution number, legal name, permanent and mailing addresses, phone, email, website, social URLs (Facebook, LinkedIn, X/Twitter, Instagram), logo URL, brand color (hex).
- **Compliance / threshold settings** remain in **Institution settings** (`InstitutionSettings`); this profile is additive branding and contact data.

## APIs (principal / administrator portal access)

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /api/principal/program-domains` | List / create domains |
| `PUT/DELETE /api/principal/program-domains/[id]` | Update / delete (blocked if referenced) |
| `GET/POST /api/principal/program-categories` | Categories |
| `PUT/DELETE /api/principal/program-categories/[id]` | |
| `GET/POST /api/principal/program-types` | Types |
| `PUT/DELETE /api/principal/program-types/[id]` | |
| `GET/PUT /api/principal/institution-profile` | Read / save profile |
| `POST /api/principal/institution-profile/logo` | Upload logo image → returns `url` for the profile field |

## UI

- **Program taxonomy** (`/principal/program-taxonomy`): tabs for Domains, Categories, Types; CRUD with optional Customer ID and sort order.
- **Institution profile** (`/principal/institution-profile`): full form + logo upload.
- **Programs** (`/principal/programs`): three dropdowns when creating/editing programs.
- **Student Apply** and **Applications** list show taxonomy where available.

## Non-goals / compatibility

- Does not change student onboarding steps, fees, or assessment flows.
- Deleting a taxonomy value that is still linked to a program or application returns **409** until unlinked.
