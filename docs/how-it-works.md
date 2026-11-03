# How Supplier Scout works

[Español](como-funciona.md) · **English**

Supplier Scout helps you find new suppliers, **including the ones with no website**, and compare them by what your order really costs. The [demo](https://dsergio909.github.io/supplier-scout/) runs in the browser, with nothing to install and no account.

## The problem

Finding a new supplier usually means a Google search, a spreadsheet and a few phone calls. Three things go wrong:

1. **Many good suppliers are not online.** Workshops, family businesses and distributors who sell by phone or WhatsApp have no website, but they do have a shop on the street.
2. **The cheapest list price is rarely the cheapest order.** Full packs, minimum orders, tax, shipping and payment terms change the total.
3. **Star ratings mislead.** A 5.0 from 2 reviews is not better than a 4.7 from 300, and "no reviews" does not mean "bad".

## Finding real businesses near you

At the top of the **Search** tab is the **Find real businesses** panel:

1. Pick **what you need** (hardware, packaging, printing, textiles, cleaning supplies and so on), the **country**, and type the **neighbourhood and city**, for example *Kennedy, Bogotá*.
2. Press **Search the map**. Within seconds, businesses that really exist in that area appear in the ranking, with phone, address and opening hours when the map has them.
3. The result message says how many were found, **how many have no website** and how many have a phone number.
4. Press **Open in Google Maps** to open the same search in Google Maps. Google usually lists more businesses; from there you can call, see photos and read reviews.
5. **Back to the sample data** returns to the demo's fictional suppliers.

### Where the data comes from

| Source | What it adds | How it is used |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/) | A community map: volunteers add shops and workshops by walking the streets, which is why many businesses without a website are on it | The app asks its place search (Nominatim) to locate the area and its Overpass service to list the businesses of that category around it. Free, no key |
| Google Maps | More businesses, photos and reviews | Only an official link that opens the search in Google Maps. It uses **no** Google keys and copies none of its data: copying Google Maps data is forbidden by Google's terms |

**Nothing is made up.** Every live result is a place that exists in OpenStreetMap, with a link to its entry. If the map has no businesses of that category in the area, the app says so and suggests a larger radius or Google Maps. The demo's sample data (Bogotá, Mexico City and São Paulo) is fictional and labelled as such.

### Limits of the live search

- The maximum radius is **10 km**, to avoid overloading OpenStreetMap's free service. If you ask for more, the app searches 10 km and tells you.
- Map data can be incomplete or out of date: **confirm by phone before you buy**.
- Businesses found on the map have no prices or reviews. They show "no reviews" (neutral) and "no quote", and the ranking tells you what to ask.
- The live search is not saved in the browser: reload and you are back to the sample data. To keep it, use **Export** in the **Data** tab.

## The five tabs

| Tab | What it is for |
|---|---|
| **1 Search** | Describe your need (category, quantity, where from, in how many days, radius and budget), pick a priority and read the ranking. Every supplier explains **why** it is in that position and has a draft quote request |
| **2 Quotes** | Turns every quote into the real cost of **your** order: full packs, minimum order, tax, shipping, currency and the value of paying later |
| **3 Offline** | Where to find formal suppliers in your country (public procurement, business registry), a reader for business cards, flyers and WhatsApp messages that works without AI, and a message to ask for referrals |
| **4 Review** | New suppliers and possible duplicates wait for a person to approve them. The system does not guess |
| **5 Data** | Where your suppliers come from, CSV or JSON import (trade-fair lists, chambers of commerce, your current sheet) and CSV export for Google Sheets |

## How the ranking works

| Factor | What it measures | When data is missing |
|---|---|---|
| Price | The total of **your** order relative to the cheapest option | Neutral, with an "ask for a quote" warning |
| Rating | Bayesian average: online reviews count less when there are few, your team's reviews count three times | Neutral |
| Distance | Within your radius; suppliers that deliver are kept even when far away | Neutral |
| Trust | Verification level (contacted, formal, visited, bought from) and independent referrals | Lowest level |
| Speed | Lead time; a warning if it misses your deadline | Neutral |

The priorities (balanced, cheapest, most reliable, nearest, urgent) change each factor's weight, or you can set them by hand.

**Why "neutral" and not "zero":** if missing data counted as zero, a workshop with no online reviews and no quote yet would always lose to a web shop. As neutral it competes, and the app tells you what to ask.

## Privacy and security

- The page connects only to the two OpenStreetMap services, and only when you press **Search the map**. A security policy (CSP) on the page enforces this: it cannot talk to any other server.
- No cookies, accounts or analytics. What you capture or import stays in your browser.
- Quote requests and referral requests are **drafts**: you review and send them. Nothing is sent automatically.

## For advanced users

Outside the browser, the same code has command-line connectors (OpenStreetMap, Colombia's SECOP II, OCDS open contracting data, Socrata portals, CSV, and Google Places with your own key) and an optional agent built on the Claude API. They produce a JSON file you import in the **Data** tab. Instructions are in the [README](../README.md#run-it).

## The 2-minute explanation

> A Google search only finds suppliers that have a website, and in Latin America many of the best ones do not: they are workshops and shops that sell by phone or WhatsApp. Supplier Scout searches OpenStreetMap, a community map where those businesses do appear because people walking the streets add them, and tells you how many have no website. One click opens the same search in Google Maps, without copying its data. Then it ranks by what your order really costs, not the list price, including minimum order, tax and shipping, and it treats ratings carefully: few reviews count for little and "no reviews" is neutral, not bad. Everything new goes through human review, and every message is a draft you send yourself.
