# JB Lux Designs website

Static site for jbluxdesigns.com. No dependencies: Netlify runs `node build.js` and publishes `dist/`.

## Where things live

| What | File |
| --- | --- |
| Email, phone, Instagram, services, featured projects | `data/site.json` |
| Projects (name, type, location, year, captions) | `data/projects.json` |
| Page layouts | `build.js` |
| Styles | `static/css/site.css` |
| Behaviour (menu, gallery viewer, filters) | `static/js/site.js` |
| Images (already optimised WebP) | `static/img/` |
| Logos and favicons | `static/brand/`, `static/favicon*` |

## Editing a project

Open `data/projects.json`, find the project by its `slug`, and fill in `location`, `year`, `scope` and `summary`.
Anything left empty shows as a `[PLACEHOLDER]` on the page. Remove `"soon": true` once a project has photos.

## Build locally

    node build.js            # writes dist/
    node build.js --preview  # writes preview/ with relative links, for review without a server

## Contact form

The form on `/contact/` uses Netlify Forms (`data-netlify="true"`). Submissions appear in the Netlify dashboard
under Forms; add an email notification there to have them forwarded.
