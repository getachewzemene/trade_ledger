# Ledger & Wick

Ledger & Wick is a local trading journal and educational assistant for traders who want to practice a repeatable process. It brings trade records, personal rules, review prompts, and learning material into one place so users can examine how they make decisions and work on more disciplined execution.

It is a support tool, not a source of trading signals or a substitute for independent judgment. The aim is to help users build and review consistent habits; it cannot ensure consistency, improve performance, or make anyone profitable.

## Important Notice

Ledger & Wick is **not a financial adviser, investment adviser, broker, exchange, or trading service**. Nothing in the application or its educational content is individualized financial, investment, legal, or tax advice, or a recommendation to buy or sell any instrument.

The app does **not** connect to a broker, receive live market data, transmit orders, automate a trading strategy, or manage a real account. The “Start demo practice” action opens a simulated journal form only. It does not create a broker demo account or execute a simulated broker order. Any example charts, prices, setups, calculations, and educational frameworks are illustrative and are not live data, signals, or evidence of a profitable edge.

Trading involves substantial risk, including the possible loss of some or all capital. Stops may execute at worse prices than expected, and spreads, slippage, gaps, leverage, fees, and contract specifications can materially change results. Backtests and simulated results do not predict future outcomes. Consult a qualified, appropriately licensed professional for advice about your circumstances.

## What It Does

- Records trades and supports CSV import, normalization, validation, and export.
- Summarizes performance, returns, drawdowns, execution quality, and behavioral rule violations.
- Provides a customizable Trading Plan with a daily checklist and configurable risk, trade-count, loss, and reward-to-risk limits.
- Includes playbook setup checklists, including educational gold examples using Daily/4H with 15-minute confirmation and Daily/1H with 5-minute confirmation.
- Offers price-action lessons on candlestick patterns, market structure, Fibonacci/OTE, volume profile, and the ICT IPDA framework.
- Presents illustrative charts and worked examples. They are schematic teaching aids, not current market prices or trading signals.
- Includes session preparation, a trading contract, cooldown prompts, position-sizing tools, and review analytics.

These features can help organize a practice routine and make decisions easier to review. They cannot verify that a setup has an edge or enforce behavior outside the application.

## Requirements

- Node.js (the app has been tested with Node.js 22).
- npm, included with Node.js.

No third-party npm packages are required to run the app.

## Run Locally

From the project folder, run:

```powershell
npm start
```

Open [http://localhost:3000](http://localhost:3000) in a browser. Keep the terminal running while using the app; press `Ctrl+C` there to stop the server.

If port 3000 is already in use, choose another port in PowerShell:

```powershell
$env:PORT = '3001'
npm start
```

Then open [http://localhost:3001](http://localhost:3001).

## Run Tests

```powershell
npm test
```

The test suite covers core calculations, validation, CSV parsing, trading-plan rules, session/profile persistence, playbook checks, and lesson chart generation.

## Suggested Practice Workflow

1. Read the relevant lesson and treat its examples as hypotheses to test, not instructions to trade.
2. Write down one setup in the Trading Plan. Define the instrument, timeframe, session, entry trigger, invalidation, target, risk cap, and no-trade conditions in advance.
3. Complete the daily plan checklist and review relevant scheduled events.
4. Use a broker's explicitly simulated environment if you need simulated fills. Confirm its instrument specifications, session times, spread, commissions, and contract/tick values. Ledger & Wick itself does not provide broker data or fills.
5. Record both valid examples and passes in a separate research log or notes. Include costs, slippage assumptions, maximum adverse/favorable excursion, and whether every rule was followed.
6. Review a meaningful sample, including losing trades and missed setups. Separate process quality from profit and loss. Avoid changing the rules to fit past outcomes; use separate examples to test revisions.

The built-in “demo practice” flow prepares a simulated journal record. To practice actual simulated order execution, use a broker's own demo platform and follow that provider's terms.

## Data, Profiles, and Security

The standalone server stores journal trades in `src/data/trades.json` and uses `src/data/sample-trades.json` as initial sample data when no saved journal exists. Runtime trade data is ignored by Git in this project to reduce the chance of committing personal journal entries. Back up important data using the application's export tools and store backups securely.

The Login control is **not authentication**. It is a local username/profile selector that stores profile data in the current browser's local storage. It does not verify a password or protect data from another person who can access the same browser or computer. Do not enter real account credentials, API keys, or other secrets. The local HTTP server is not designed as a hardened, public, multi-user production service; do not expose it to the internet without adding appropriate authentication, access control, transport security, and server hardening.

## Educational Frameworks

Some lessons use terminology from discretionary trading communities, including OTE and ICT/IPDA. These labels are interpretive frameworks, not standardized exchange definitions or verified descriptions of a single algorithm controlling prices. Price structures, volume-profile references, and pattern interpretations can be subjective. Volume availability and meaning differ by instrument and data feed; for example, broker tick volume for an OTC/CFD symbol is not the same as centralized exchange-traded futures volume. Verify the data source and instrument specifications you use, and test any written rules independently.

## Project Scripts

- `npm start` — start the local HTTP server.
- `npm test` — run the automated test suite.
