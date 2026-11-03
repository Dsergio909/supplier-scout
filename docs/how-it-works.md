# How Supplier Scout works

[Español](como-funciona.md) · **English**

Supplier Scout helps you find new suppliers of goods **and services**, **including the ones with no website**, and compare them to decide whom to ask for a quote. The [demo](https://dsergio909.github.io/supplier-scout/) runs in the browser, with nothing to install and no account.

## The problem

Finding a new supplier usually means a Google search, a spreadsheet and a few phone calls. Three things go wrong:

1. **Many good suppliers are not online.** Workshops, family businesses and distributors who sell by phone or WhatsApp have no website, but they do have a shop on the street.
2. **The cheapest list price is rarely the cheapest order.** Full packs, minimum orders, tax, shipping and payment terms change the total.
3. **Star ratings mislead.** A 5.0 from 2 reviews is not better than a 4.7 from 300, and "no reviews" does not mean "bad".

## Finding suppliers near you

At the top of the **Search** tab is the search bar:

1. In **What do you need?** type a product or a service in your own words: *air conditioning maintenance*, *plumber*, *fire extinguisher refill*, *pest control*, *cardboard boxes*, *hardware*. Below it the app shows what it understood, for example **I understood: Air conditioning & refrigeration**.
2. Type the **city, town or neighbourhood**: *Barranquilla*, *Guatavita*, *Kennedy, Bogotá*. Pick the **country**, or press **Use my location** to search where you are.
3. Press **Search the map**. Within seconds, businesses that really exist in that area appear in the ranking, with phone, address and opening hours when the map has them.
4. Above the ranking you can filter **With phone** or **No website** and sort by **Recommended** or **Nearest** (by driving time when available).
5. The result message says how many were found, **how many have no website** and how many have a phone number.
6. Press **Open in Google Maps** to open the same search in Google Maps. Google usually lists more businesses; from there you can call, see photos and read reviews.
7. Every business shows its address and opening hours when the map has them, a **Call** button, **View on OpenStreetMap** (its map entry) and **Find on Google Maps** (photos, reviews, call). **Request a quote** drafts a message for WhatsApp or email; for a service it asks for the price of the job, what it includes and the response time.
8. **Back to the sample data** returns to the demo's fictional suppliers.

**No quantities needed.** In purchasing you first look for several options and negotiate the quantity with each supplier. Quantities only appear in the **Quotes** tab, once you have prices and want to compare the real cost of an order.

### How it identifies the place

- **A whole city or town.** Type just *Barranquilla* or *San Gil* and it searches the whole municipality and its surroundings. If the city reaches more than 10 km from its centre (Bogotá, Barranquilla, Medellín), it searches 10 km around the centre and says so: for another area, type the neighbourhood.
- **Repeated names.** Many towns share a name (*San Pedro*, *La Unión*, *Santa Rosa*). The app shows where it searched, with the region (*San Pedro, Valle del Cauca*), and offers the others below: **Not that one? Pick: San Pedro, Antioquia · San Pedro, Sucre**. Picking one does not query the place search again.
- **Wrong country.** Type *Lima* with Colombia selected: it is not found in Colombia, so the app looks in the rest of the world, says *Not found in Colombia: searched Lima (Peru)* and switches the country.
- **Use my location.** The browser asks for permission; the position is used only for the map query and is not stored.
- Place search is OpenStreetMap's Nominatim. Its usage policy forbids search-as-you-type, so the app searches when you press the button.

### How it reads what you type

No AI: rules, so it can always explain what it searched for.

1. **Trades and services** it recognises in Spanish, English, Portuguese and French, with plurals and without accents: air conditioning and refrigeration, plumbing, electricians, locksmiths, welding and metalwork, painters, glass and windows, building and renovation, roofing and waterproofing, gardening, pest control, cleaning services, laundry, vehicle and tyre repair, machining, computers and IT support, appliances, upholstery, signs, catering, moving, security and cameras, fire extinguishers and safety, elevators, generators and pumps, accounting and lawyers. Each knows its OpenStreetMap tags (for example `craft=hvac` for air conditioning) and the words businesses usually have in their names (*refrigeración*, *climatización*).
2. If it is not a trade, it looks at the **purchase categories**: packaging, hardware, printing, textiles, electronics, food, cleaning supplies, transport, maintenance, office supplies, furniture and 3D printing.
3. If it recognises nothing, it searches for businesses with **those words in their name** and says so.

The word *maintenance* alone decides nothing: *elevator maintenance* searches for elevator companies, not plumbers.

### Where the data comes from

| Source | What it adds | How it is used |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/) | A community map: volunteers add shops and workshops by walking the streets, which is why many businesses without a website are on it | The app asks its place search (Nominatim) to locate the area and its Overpass service to list the businesses of that category around it. Free, no key |
| Google Maps | More businesses, photos and reviews | Only an official link that opens the search in Google Maps. It uses **no** Google keys and copies none of its data: copying Google Maps data is forbidden by Google's terms |

**Nothing is made up.** Every live result is a place that exists in OpenStreetMap, with a link to its entry. If the map has no businesses of that category in the area, the app says so and suggests a larger radius or Google Maps. The demo's sample data (Bogotá, Mexico City and São Paulo) is fictional and labelled as such.

### Checked with real data

In November 2026 the app was run against the real OpenStreetMap services with 12 purchasing searches in Colombia, Peru, Mexico and Brazil (the manual `live-check.yml` workflow in GitHub Actions). All **46 businesses checked exist** on the official OpenStreetMap API with the name the app shows. Where the map is well covered it found 16 to 37 real businesses (hardware stores in Barranquilla and Coyoacán, stationers in Chapinero, garages in Pinheiros). For trades such as locksmiths, pest control or fire-extinguisher refills, San Gil, Cali, Medellín and Miraflores returned 0: those businesses are not on the map, which is what **Open in Google Maps** is for.

**When the main server is slow.** The public server that finds businesses (Overpass) sometimes takes 30 seconds or more. If it has not answered in 5 seconds, the app asks the OpenStreetMap search (Nominatim) in parallel, which answers in under a second, and says so: *Source: OpenStreetMap search*. That search returns up to 40 businesses per type.

### Limits of the live search

- The maximum radius is **10 km**, to avoid overloading OpenStreetMap's free service. If you ask for more, the app searches 10 km and tells you.
- If the map server is busy, the app retries once after 3 seconds; if it is still busy, it asks you to try again in a minute.
- Map data can be incomplete or out of date: **confirm by phone before you buy**.
- Businesses found on the map have no prices or reviews. They show "no reviews" (neutral) and "no quote", and the ranking tells you what to ask.
- A business only appears if someone added it to OpenStreetMap with the right tag or name. If you do not find what you need, try other words or open Google Maps.
- The live search is not saved in the browser: reload and you are back to the sample data. To keep it, use **Export** in the **Data** tab.

## The map and driving times

- Next to the filters is a **real OpenStreetMap map**. The dashed circle is your search radius and each number is the supplier's place in the ranking. Drag to move, use **+** and **−** to zoom and tap a number to jump to its card.
- In a live search the app works out **how long it takes by car** to each business and the road distance (OSRM, on OpenStreetMap data). Times are approximate and ignore traffic. If that service does not answer, the straight-line distance is shown.

## My shortlist: from options to a decision

Purchasing usually gathers several options, asks for **at least three quotes** and compares them in a **comparison table** (price, lead time, payment terms, warranty) before choosing. The **My list** tab follows that process:

1. On each card, **Add to my list** saves the supplier with its phone, address and what you were looking for.
2. In **My list** you mark where each one stands: *To contact*, *Contacted*, *Quoted*, *Chosen* or *Discarded*, and note the quoted price, lead time, payment terms and your notes.
3. Progress is shown on top: **2 of 3 recommended quotes**.
4. **Request quotes from the rest** prepares the message for everyone still *To contact*, each with their name: open it in WhatsApp (mobile numbers only) or copy it for email, and the supplier moves to *Contacted*. It is what tools such as Thomasnet do with their one-to-many request, but over WhatsApp, which is how the region buys.
5. **Check:** next to each supplier are links to the official portals of its country to check it before registering it: RUES and DIAN in Colombia, SAT in Mexico (including the 69-B list of companies issuing simulated invoices), SUNAT in Peru, SII in Chile, ARCA in Argentina, SRI in Ecuador and Receita Federal in Brazil. They are home pages: search there by name or tax ID.
6. **Download comparison table** creates a file that opens in Excel or Google Sheets, with columns for price, lead time, payment terms, warranty, notes and the map link.

The list is saved only in your browser and survives other searches and reloads. The app also remembers your last 5 places to repeat them with one tap.

**Documents to register the supplier.** In **Request a quote** you can tick *Include the documents needed to register them as a supplier*. For Colombia the message asks for what companies usually require: an up-to-date RUT, a recent Chamber of Commerce certificate, a bank certificate and a copy of the legal representative's ID. Other countries get the name of their tax ID (RUC, RFC, CNPJ...). Every company has its own list: adjust the message if yours asks for more.

## The six tabs

| Tab | What it is for |
|---|---|
| **1 Search** | Type what you need and where, set the radius and priority, and read the ranking. Every supplier shows its phone, its unit price if it has quoted, explains **why** it is in that position and has a draft quote request |
| **2 My list** | The suppliers you will contact, their status and the comparison table to download |
| **3 Quotes** | Once you have prices: enter the quantity and turn every quote into the real cost of the order (full packs, minimum order, tax, shipping, currency and the value of paying later) |
| **4 Offline** | Where to find formal suppliers in your country (public procurement, business registry), a reader for business cards, flyers and WhatsApp messages that works without AI, and a message to ask for referrals |
| **5 Review** | New suppliers and possible duplicates wait for a person to approve them. The system does not guess |
| **6 Data** | Where your suppliers come from, CSV or JSON import (trade-fair lists, chambers of commerce, your current sheet) and CSV export for Google Sheets |

## How the ranking works

| Factor | What it measures | When data is missing |
|---|---|---|
| Price | The quoted unit price with tax relative to the cheapest one (no quantity: that is negotiated later). Flags a minimum order | Neutral, with an "ask for a quote" warning |
| Rating | Bayesian average: online reviews count less when there are few, your team's reviews count three times | Neutral |
| Distance | Within your radius; suppliers that deliver are kept even when far away | Neutral |
| Trust | Verification level (contacted, formal, visited, bought from) and independent referrals | Lowest level |
| Speed | Lead time; a warning if it misses your deadline | Neutral |

The priorities (balanced, cheapest, most reliable, nearest, urgent) change each factor's weight, or you can set them by hand.

**Why "neutral" and not "zero":** if missing data counted as zero, a workshop with no online reviews and no quote yet would always lose to a web shop. As neutral it competes, and the app tells you what to ask.

## Privacy and security

- The page connects only to OpenStreetMap-based services: place search (Nominatim), map data (Overpass) and driving times (OSRM), and only when you press **Search the map**. Map images come from OpenStreetMap's tile servers. A security policy (CSP) on the page enforces this: it cannot talk to any other server.
- **Why there is no backup map server:** the alternative Overpass servers I checked can serve stale data without saying so. One retry and a clear message are better than outdated businesses.
- **Why Google reviews are not inside the app:** showing Google data next to a non-Google map goes against Google's terms, and the key would be exposed in the browser. For reviews and photos, every card has **Find on Google Maps**.
- No cookies, accounts or analytics. What you capture or import stays in your browser.
- Quote requests and referral requests are **drafts**: you review and send them. Nothing is sent automatically.
- **Fair use of the free services:** at most one request per second to place search and routing, even across several fast searches.
- **Your location:** *Use my location* sends it rounded to about 100 m; the exact position never leaves the browser.
- **Browser protection:** the page turns on Trusted Types and never builds HTML from text, so a malicious business name on the map cannot run code.
- **Results you did not ask for:** the search also looks at words inside business names. The words were chosen not to bring real but unrelated businesses ("gardening" does not bring kindergartens, "packaging" does not bring a bank called "Caja Social"), and automated tests watch for it.

## For advanced users

Outside the browser, the same code has command-line connectors (OpenStreetMap, Colombia's SECOP II, OCDS open contracting data, Socrata portals, CSV, and Google Places with your own key) and an optional agent built on the Claude API. They produce a JSON file you import in the **Data** tab. Instructions are in the [README](../README.md#run-it).

## The 2-minute explanation

> You type what you need the way you would say it, for example "air conditioning maintenance", and the area. A Google search only finds suppliers that have a website, and in Latin America many of the best ones do not: they are workshops and shops that sell by phone or WhatsApp. Supplier Scout searches OpenStreetMap, a community map where those businesses do appear because people walking the streets add them, and tells you how many have no website. One click opens the same search in Google Maps, without copying its data. It does not ask for quantities, because in purchasing you look for options first and negotiate the amount later; once you have quotes, it compares the real cost of the order with minimum order, tax and shipping. And it treats ratings carefully: few reviews count for little and "no reviews" is neutral, not bad. Everything new goes through human review, and every message is a draft you send yourself.
