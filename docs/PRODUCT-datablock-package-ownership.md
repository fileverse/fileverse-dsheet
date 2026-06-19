# Data Blocks: Full Package Ownership

**Date:** 2026-06-15
**Status:** Approved

---

## The Goal

Make data blocks work out of the box. Today, anyone who embeds the spreadsheet in their own product has to build a large chunk of the data block experience themselves — error handling, API key storage, the API key prompt, and the wiring between all of them. This is fragile, easy to get wrong, and duplicated by every team that uses the spreadsheet.

After this change, the spreadsheet owns the entire data block experience. A product team that embeds the spreadsheet has to configure nothing. They get the full working experience automatically, and they receive simple notifications about what's happening if they want them.

---

## What a Data Block Is

A data block lets a user pull live external data into a cell by typing a formula — for example, fetching a crypto price or other market data from an outside service. Some of these services require an API key. The experience has to gracefully handle the moment a user needs a key, let them enter it, store it, and continue without losing their work.

---

## The Problem Today

To use data blocks, an embedding product currently has to:

- Build the logic that catches data block errors and decides what to do with them
- Build and manage the popup that asks the user for an API key
- Track which key is being requested at any moment
- Store and retrieve API keys
- Keep all of these pieces in sync with each other

This is a lot of responsibility to hand to every team. It's complex, repetitive, and any mistake degrades the experience for end users.

---

## The Experience After This Change

The spreadsheet handles the full flow on its own:

1. A user types a formula that pulls in external data.
2. If it succeeds, the cell fills with the result.
3. If the external service needs an API key the user hasn't provided yet:
   - The cell shows a clear "waiting for API key" state so the user isn't confused.
   - A prompt appears asking the user to enter the key.
   - When the user saves the key, it's stored automatically.
   - The formula re-runs on its own and fills the cell with the result.
4. If the formula fails for another reason, the cell shows a clear error indicator.

The user never loses their place. The whole recover-from-missing-key journey happens inside the spreadsheet without the embedding product doing anything.

---

## What the Embedding Product Gets

### Zero required setup

The data block experience — including the API key prompt and key storage — is fully built in. An embedding product turns it on simply by using the spreadsheet. No prompt to build, no error logic to write, no key management to maintain.

### One optional notification stream

If a product wants visibility into what's happening, it can subscribe to a single stream of lifecycle events. These events let the product do its own analytics, logging, or side effects. The events cover:

- **Success** — a data block successfully fetched and filled a cell
- **Error** — a data block failed
- **API key required** — the user has been asked for a key
- **API key saved** — the user entered and saved a key
- **Retry** — the formula is being re-run after the key was provided

Each event carries useful context where relevant: which data block function was involved, what kind of error occurred, and which key was requested.

This is entirely optional. A product that doesn't care about any of this can ignore it and everything still works.

### Optional control over where keys are stored

By default, API keys are stored locally on the user's device. A product that needs keys stored somewhere else — for example, in its own secure backend — can supply its own storage behavior instead. This is optional; most products will use the default.

---

## What Goes Away

Products that previously embedded the spreadsheet had to provide several pieces of custom plumbing for data blocks: a custom error handler, a key-storage hook, and the entire API key prompt with all its supporting state. All of that is removed. Those products now configure nothing for data blocks — they only keep the optional event subscription if they want analytics.

The older, narrower "data block response" notification is replaced by the richer lifecycle event stream described above, which covers the same success case plus much more.

---

## The API Key Prompt

The prompt that asks users for a key — including its input field and the supporting rate-limit guidance — now lives inside the spreadsheet itself. It appears automatically when needed and closes itself when the user is done.

This prompt is intentionally **not** customizable by embedding products. Keeping it owned and consistent is a deliberate decision: every product that uses the spreadsheet gives users the same reliable, polished key-entry experience.

---

## A Cleaner Recovery Flow

Behind the scenes, the way the spreadsheet waits for the user to enter a key is being made more reliable. Previously it constantly checked, many times a second, whether the prompt had closed yet. Now it simply waits for the user to save the key and then continues. This is smoother and less wasteful, and the user-facing result is the same seamless "enter key, cell fills in" experience.

---

## Before vs. After (Embedding Product's View)

**Before:** the product had to wire up key storage, write a custom error handler, manage the state of the key prompt, render the prompt itself, and keep all of it coordinated.

**After:** the product writes nothing for data blocks. It optionally listens to lifecycle events for its own analytics. The key prompt and everything around it run automatically inside the spreadsheet.
