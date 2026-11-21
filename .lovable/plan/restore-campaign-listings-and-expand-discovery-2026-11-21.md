# Restore campaign listings and expand discovery

## What will change
- Return the six seeded Kenyan campaigns to the discovery feed as active campaigns with no deadline.
- Expand discovery into a full-width responsive tile grid: one column on mobile, two from 768px, three from 1024px, and four from 1280px.
- Give each tile equal row height and make the introduction and header use the available desktop width.

## Technical details
- Update only the six seeded campaign records: clear their deadlines and completion timestamps, and set them active. Existing expiry checks already treat a null deadline as indefinite.
- Keep the other campaign expiry rules unchanged.
- Validate the indefinite active lifecycle and inspect the page at mobile, tablet, desktop, and large-desktop widths.