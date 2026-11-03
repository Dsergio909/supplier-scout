# How Supplier Scout works

[Español](como-funciona.md) · **English**

Supplier Scout finds suppliers of goods and services the way purchasing does: gather several options for every need and compare them before asking for quotes. The [demo](https://dsergio909.github.io/supplier-scout/) runs in the browser, with nothing to install and no account.

## The problem

A map answers "who is near me?". Purchasing asks "who can supply this, and on what terms?". Often the best answer is not nearby:

1. **Supplies are bought from national companies.** Stationery, cleaning supplies, uniforms or toner usually come from distributors that deliver nationwide, invoice electronically and give 30, 60 or 90 days of credit or quarterly payment. Their warehouse is in another city, so a map never shows them.
2. **One supplier can cover several needs.** The distributor that sends stationery may also send cleaning and coffee supplies: one supplier to register, one contract, one invoice.
3. **Purchasing needs several options.** Three quotes is the usual rule, and options come from different places: the state's own suppliers, the ones you know, the shop around the corner, a Facebook page, a referral.
4. **Many good small suppliers are not on the web.** Workshops and family businesses sell by phone or WhatsApp and appear on community maps, not in search results.

## Searching

1. In **What do you need?** type it in your own words: *stationery*, *cleaning and office supplies*, *fire extinguisher refill*, *security guards*, *plumber* (Spanish, Portuguese and French work too), or tap one of the examples.
2. Type **the city or area** (*Bogotá*, *Kennedy, Bogotá*, *San Gil*) or press **Use my location**, and choose the **country**.
3. Press **Search**. The app says what it understood and why it orders the results as it does:
   - **Supplies** (stationery, cleaning, uniforms, packaging) can be shipped from any city, so national suppliers come first.
   - **On-site services** (plumber, locksmith, electrician) need someone to come over, so nearby businesses come first.
   - **Services usually provided by companies** (security, fire extinguishers, pest control) show both.

Results come in four layers.

### 1. National suppliers (Colombia)

Companies **and individuals** that already sell that need to public entities, according to **SECOP II**, Colombia's public procurement system, which publishes every contract as open data on datos.gov.co.

| Column | What it shows |
|---|---|
| Supplier | Name and registered city; the tax ID (NIT) for a company, or *Individual* (their ID number is not shown) |
| Reach | **National** if it sold in 3 or more departments in the last 2 years, **Regional** if in 2, **Local** if in 1, and whether that includes your area |
| Contracts | How many contracts for that need, and the date of the last one |
| What they sold | **A real contract as an example**, such as *Supply of stationery, office supplies, toner and ink…*, so you can see why the company is listed |
| Contact | The phone, email and website the supplier registered in SECOP. Old 7-digit landlines get their area code (601, 604…) so they can be dialled |

- **Why it helps:** a company that sells in many departments already ships nationwide, invoices formally and handles volume: the kind of supplier that gives credit or quarterly payment.
- **Several needs:** for *cleaning and stationery*, companies that sell both come first.
- **Your own words first:** if you typed something more specific than the category (*toner for printers* rather than *stationery*), companies that sold exactly that come first.
- **Companies and individuals.** In Latin America many suppliers are individuals (personas naturales), and they are sometimes cheaper: in SECOP they win 30 to 40% of the contracts for stationery, extinguishers, pest control or air conditioning. Above the table you can show **All**, only **Companies** or only **Individuals**.
- **What is left out:** people the state hires as quasi-staff (*prestación de servicios profesionales y de apoyo a la gestión*, *operario*, *sin subordinación*), agreements with non-profits (Decreto 092 de 2017), leases, minors' ID documents, public utilities (E.S.P.) and joint ventures.
- **Careful with an individual's data.** Their tax ID is their national ID number: the app uses it only to look up their public contact and **never shows, saves or exports it**; Google is searched by name and city. Their phone and email are personal data: use them only to request a quote (Colombia's Ley 1581 of 2012).
- **Before buying from an individual:** ask for their RUT; if they do not issue electronic invoices, your company issues the *documento soporte*; for a service, also ask for proof of social security payments. The quote request already asks them for their own papers (ID, RUT, bank certificate and business registration if they have one), not a company's.
- **Add to my list** saves the supplier with its contact and coverage (and the tax ID for a company). **Search on Google** opens its name (and tax ID for a company) in Google to check its website, reviews or news.

Other countries have no registry connected yet: the layer says so and the internet searches remain.

### 2. Your suppliers for this

The suppliers you saved in **My list** for those categories, with their terms. If there are none, **Add a supplier I already know** opens the form.

### 3. Nearby

Real businesses from **OpenStreetMap**, the community map where people record shops and workshops by walking the streets, which is why many businesses without a website appear.

- A map with the search radius and a number per business; tapping a number jumps to its card.
- The approximate driving time (OSRM, no traffic), address, opening hours and phone when the map has them.
- For supplies this layer does not load by itself: press **Also find shops near…**.
- A line below says how many were found, how many have no website and how many have a phone.

**The place.** Typing just *Barranquilla* or *San Gil* searches the whole town (up to 10 km from the centre in big cities, with a note). Towns that share a name (*San Pedro*) are told apart and offered as alternatives. *Lima* typed with Colombia selected is found in Peru and the country switches.

### 4. Search the internet

Ready-made searches that open in a new tab: wholesalers and nationwide distributors on Google, companies on LinkedIn, the need plus your area on Google, business pages on Facebook (many small suppliers are only there) and the same search on Google Maps, which usually has more businesses, photos and reviews. For an on-site service only the local searches appear.

These are plain links: Supplier Scout copies nothing from those sites (copying Google or Facebook data is against their terms). If you find a good one, add it with **Add supplier**.

## My list: from options to a decision

Purchasing gathers several options, asks for **at least three quotes** and compares them in a **comparison table** before choosing. **My list** follows that process.

- **Add supplier:** paste a WhatsApp message, a business card or an email and press **Fill from text**. The app picks out the name, phone, email, credit days, delivery coverage and what they sell, and says what it filled in so you can check it. No AI, works offline.
- **Each supplier can have several categories** (stationery and cleaning) and its **commercial terms**: credit days, payment (cash, monthly, quarterly or other), delivery coverage (local, regional or national), electronic invoicing, price, lead time and notes.
- **Progress per category:** *Stationery & office: 1 of 3 quotes*, and the list can be filtered by category.
- **Status:** to contact, contacted, quoted, chosen or discarded.
- **Request quotes** drafts one message per supplier still to contact, with their name, also asking for the documents to register them as a supplier (in Colombia: RUT, Chamber of Commerce certificate, bank certificate and the legal representative's ID). Open it in WhatsApp or your email, or copy it, and the supplier moves to *contacted*.
- **Check the company:** links to each country's business and tax registries (RUES and DIAN in Colombia).
- **Download table (Excel):** a file for Excel or Google Sheets with contact, tax ID, categories, coverage, credit, payment, e-invoicing, price, lead time, status and notes.

The list is stored only in your browser.

## Checked with real data

In November 2026 the app was run against the real services from a manual GitHub Actions workflow (`live-check.yml`): the SECOP II queries with the page's own code, every company checked by its tax ID in the SECOP data and in the supplier registry, the OpenStreetMap search, and the whole page in a browser on desktop and on a phone. Last run (3 November 2026): **10 national searches** (stationery, cleaning and stationery, extinguisher refills, private security, security, cardboard boxes, toner, uniforms, cleaning products, plumber). In 9 of them the companies listed are the right kind; for *plumber* they are hardware and building-maintenance suppliers, because the state rarely hires plumbing on its own. **All 40 companies checked by tax ID** have contracts under that NIT and are in the SECOP supplier registry, and **21 of 21 map businesses** checked exist on OpenStreetMap with the same name. In the browser, searches took 3-9 s on desktop and on a phone, with no console or security-policy error and nothing wider than the screen. The first run is what shaped this version: single words brought the wrong companies (*vigilancia* brought epidemiological surveillance, *empaques* brought laundries), individuals appeared with their ID number, old landlines had no area code, and the national table overflowed on a phone. All of that is fixed and covered by tests. **With individuals (second round, same day):** 12 national searches; individuals are 15-20 of the 40 suppliers listed in most of them (2 for private security, 0 for cardboard boxes), none of them a quasi-staff contract, and all 58 suppliers checked have contracts under that tax ID and are in the registry. One individual who refills extinguishers sells in 17 departments. No ID number of an individual appears on screen or in the published results. The map alone found nothing for 6 of 12 searches (cardboard boxes in Fontibón, extinguisher refills in Cali, a locksmith in San Gil), which is why it is one layer of four.

## Limits

- The national layer exists only for Colombia.
- SECOP shows who sells to the state: a strong signal of capacity and formality, but not the whole market. Many good suppliers never sell to the state, which is why the other layers exist.
- The example is one of the company's contracts and the contact details are the ones it registered: **confirm by phone before buying**.
- The map depends on what the community has recorded: plumbers, locksmiths or extinguisher refills sometimes return few or none, which is what the Google Maps and Facebook links are for.
- Driving times ignore traffic.

## Privacy and security

- The page connects only to datos.gov.co (SECOP II), OpenStreetMap's place search (Nominatim), its data (Overpass) and driving times (OSRM), and only when you press **Search**. A Content Security Policy in the page enforces it.
- Only the words searched are sent to datos.gov.co. If you use your location, it is rounded to about 100 m.
- No cookies, accounts or analytics. Your list stays in your browser.
- The page never builds HTML from outside text (Trusted Types enforced), so a hostile name on the map or in SECOP cannot run code.
- Messages are **drafts**: you review and send them.

## For advanced users

Outside the browser, the same code has a command line and an optional agent on the Claude API: connectors (OpenStreetMap, SECOP II, OCDS procurement data, Socrata portals, fair and chamber-of-commerce CSVs, Google Places with your own key), the real cost of an order (packs, minimum order, tax, shipping, currency and payment term), fair ratings, trust from referrals and duplicate detection. Instructions are in the [README](../README.md#run-it).

## Explaining it in 2 minutes

> You type what you need, say "stationery", and your city. Purchasing does not buy stationery from the corner shop: it buys from large distributors that ship nationwide and give credit. Supplier Scout finds them in Colombia's open procurement data: companies that already sell stationery to the state in many departments, with a real contract as an example and their contact details. Ask for cleaning and stationery, and the companies that sell both come first. Then you see the suppliers you already have with their payment terms, nearby businesses on the map, and ready-made searches on Google, LinkedIn and Facebook. Ask for a plumber and the order flips: nearby first. You save the ones that fit, request three quotes by WhatsApp or email, and download the comparison table.
