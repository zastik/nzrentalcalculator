# NZ Rental Property: Keep vs Sell Calculator

Single self-contained HTML file. Open `index.html` in any browser — no build step, no server needed.

Depends on [Chart.js](https://www.chartjs.org/) loaded from CDN for the two charts (the calculator still works without it; only the charts are skipped), and Google Fonts (Fraunces, IBM Plex Sans, IBM Plex Mono — system fallbacks apply offline).

Inputs persist to `localStorage` and can be shared via the **Copy share link** button, which encodes every input in the URL query string. URL parameters take priority over saved values on load.

---

## What it calculates

Compares two scenarios year by year over a projection horizon:

| Scenario | Description |
|---|---|
| **Keep** | Hold the rental property. Collect rent, pay costs, pay down the mortgage, benefit from capital appreciation. |
| **Sell & Invest** | Sell (now, or in a chosen future year), release equity, invest the net proceeds at the chosen alternative return rate. |

Outputs: summary cards, a year-by-year table, and two charts (net worth over time and annual cashflow comparison).

---

## Input variables

### Property
| Field | Description |
|---|---|
| Purchase price | Original purchase price — only used if bright-line test applies. |
| Current market value | What the property would sell for today. |
| Mortgage balance | Outstanding loan principal. |
| Interest rate | Annual mortgage interest rate (fixed for the projection). |
| Remaining term | Years left on the mortgage. Ignored (and disabled) if interest-only. |
| Weekly rent | Gross rent charged per week (year 1). |
| Capital growth | Expected annual property value appreciation. |
| Rent growth | Annual rent increase %. Keep this consistent with capital growth and investment returns — all inputs are nominal. |
| Cost inflation | Annual increase applied to rates, insurance, maintenance, and body corp. Management fees scale with rent automatically. |
| Interest-only | If checked, no principal is repaid — the mortgage balance stays constant and payments are interest only. |

### Operating costs (annual, year-1 values)
| Field | Description |
|---|---|
| Rates | Council rates. |
| Insurance | Landlord / house insurance. |
| Maintenance | Repairs and general upkeep. |
| Body corp | Body corporate fees (apartments / units). |
| Property mgmt | Property management fee as a % of gross rent. |
| Vacancy | Weeks per year the property sits empty between tenants. |

### Tax settings (NZ-specific)
| Field | Description |
|---|---|
| Marginal tax rate | Your personal income tax bracket (10.5% / 17.5% / 30% / 33% / 39%). Used for rental profit tax and bright-line capital gains tax. |
| Interest deductible % | Percentage of mortgage interest you can claim as a tax deduction. 100% from April 2025 under the phase-in. Set lower to model earlier years. |
| Bright-line applies | If checked, capital gains on the sale are taxed at your marginal rate. The bright-line test is 2 years for property acquired on or after 1 July 2024 — leave unchecked if the window will have passed by the sale year. |

### Selling costs
| Field | Description |
|---|---|
| Agent commission | Real estate agent fee as % of sale price (typically 2–4%). |
| Marketing | Advertising / staging costs. |
| Legal fees | Conveyancing / solicitor fees. |
| Liquidation basis | If checked, future selling costs are also deducted from the Keep scenario's net worth each year, so both scenarios are compared on a "wealth if realized" basis. Off by default (Keep is compared on paper equity). |

### Alternative investment
Choose a pre-set benchmark or enter a custom rate. Editing either field manually switches the highlight to Custom. All benchmarks default to 28% PIE tax:

| Benchmark | Return | Notes |
|---|---|---|
| Term Deposit | ~5% | Typically via a PIE term deposit. |
| NZX50 | ~8% | Long-run NZ equities (PIE fund). |
| S&P500 | ~10% | Long-run US equities (PIE fund). |
| Managed Fund | ~7% | Balanced managed fund (PIE fund). |
| Custom | Enter your own | Set any return % and tax %. |

### Projection
| Field | Description |
|---|---|
| Years to project | How many years to run the comparison (1–40). |
| Sell in year | 0 = sell immediately. A value of *k* means the Sell scenario holds the property (identically to Keep) through year *k*, sells at that year's projected value, and invests the proceeds from then on. Clamped to the projection horizon. |
| Inflation | Deflator used by the today's-dollars toggle (does not affect the model itself). |
| Show in today's dollars | Divides every displayed year-*y* figure by (1 + inflation)^*y* so long-horizon numbers read as real purchasing power. Winner and crossover are unaffected (both scenarios deflate identically). |

---

## Calculation methodology

### Keep scenario — each year *y*

1. **Gross rent** = weekly rent × (52 − vacancy weeks) × (1 + rent growth)^(y−1).
2. **Operating expenses** = (rates + insurance + maintenance + body corp) × (1 + cost inflation)^(y−1) + gross rent × property mgmt %.
3. **Mortgage** — monthly amortization using the standard PMT formula (or `balance / term` when the rate is 0%). Each month's interest and principal are calculated from the outstanding balance. Interest-only loans accrue interest on a constant balance with no principal component.
4. **Deductible interest** = annual mortgage interest × interest deductible %.
5. **Taxable rental income** = gross rent − operating expenses − deductible interest.
6. **Ring-fencing** — if taxable income is negative, the loss is carried forward to offset future rental profits (cannot offset non-rental income).
7. **Tax** = taxable income × marginal tax rate (minimum $0 — ring-fenced losses carry forward).
8. **Net cashflow** = gross rent − operating expenses − mortgage interest − mortgage principal − tax.
9. **Mortgage balance** reduced by principal repaid.
10. **Property value** grows by the annual capital growth rate.
11. **Accumulated cashflow** — net cashflow each year is invested (positive) or drawn down (negative) at the after-tax alternative return rate.
12. **Net worth** = property value − mortgage + accumulated cashflow − (future selling costs, if liquidation basis is on).

### Sell & Invest scenario

1. **Selling cost** = sale-year value × agent commission % + marketing + legal fees.
2. **Bright-line tax** (if applicable) = (sale value − purchase price − selling costs) × marginal tax rate. Selling costs are deductible against the gain.
3. **Net proceeds** = sale value − mortgage balance at sale − selling costs − bright-line tax.
4. If selling in year *k* > 0, years 1..k−1 are identical to Keep; at the end of year *k* the proceeds plus accumulated cashflow become the invested pot.
5. From the sale onward the pot grows at: **alternative return × (1 − investment tax rate)**.

### Comparison

- **Crossover year** — the last year the lead changes; the final winner stays ahead from that year on. (The first crossing can mislead when Keep leads early on cashflow but Sell compounds past it later.)
- **Winner** — whichever scenario has higher net worth at the end of the projection.
- **Break-even growth** — the verdict banner also bisects for the capital growth rate at which Keep and Sell finish level (searched over −5%…15%), so the verdict is presented alongside the assumption it hinges on.
- **Sensitivity grid** — a 5×5 table of final-year margins across capital growth ±2% (rows) and alternative return ±2% (columns), colored by winner, with the current assumptions outlined.
- **Derived metrics** — gross yield (weekly rent × 52 ÷ current value) on the cashflow card, and an annualized "≈% p.a. on today's equity" on both net-worth cards, computed from the displayed (nominal or real) final values against today's paper equity.

### Scenarios, export, print

- **Saved scenarios** — the current inputs can be saved under a name (localStorage); each saved set-up is re-run through the model live and listed with its Keep/Sell finals and winner alongside a "Current inputs" row for side-by-side comparison.
- **CSV export** — downloads the year-by-year table as displayed (respects today's-dollars mode).
- **Print stylesheet** — printing collapses to one column, expands the full table, and hides buttons, so the page can go to a broker or accountant as a PDF.

---

## Tests

`tests/run-tests.js` runs the page's real inline script against a stubbed DOM in
JavaScriptCore (macOS built-in — no Node or browser needed):

```sh
osascript -l JavaScript tests/run-tests.js   # from the repo root
```

It asserts the model's hand-checked numbers (zero-rate amortization,
interest-only cashflow, bright-line proceeds, deferred-sale continuity,
liquidation basis, clamping, real-mode deflation) plus the sensitivity grid,
scenario storage, and derived metrics.

---

## Assumptions & limitations

- **Fixed interest rate** for the entire projection. No refix / rate-change modelling.
- **All inputs are nominal** — pick rent growth, cost inflation, capital growth, and investment returns on a consistent basis.
- **Rental cashflow surplus is invested** at the alternative return rate; deficits are drawn down at the same rate (equivalent to the Sell scenario investing that same money).
- **Tax treatment is simplified** — uses a single flat marginal rate rather than progressive brackets; a bright-line gain could in practice push income into a higher bracket.
- **Bright-line window is not date-aware** — the checkbox applies to the sale whenever it happens; the user decides whether the (2-year) window still applies at the chosen sale year.
- **No depreciation** on chattels included (deductible in practice but adds complexity).
- **No accountant fees, compliance costs (e.g. Healthy Homes), or capital improvements** modelled.
- **Sale executes at projected market value** — no market timing or negotiation margin modelled.
- **No CGT beyond bright-line** — capital gains on the property are tax-free once the bright-line window has passed (standard NZ treatment).
