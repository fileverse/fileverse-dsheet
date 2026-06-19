# Product Requirements: A Complete Drop-In Spreadsheet Editor

## Overview

The spreadsheet editor is offered as a reusable product that other applications can embed. Today it is not truly self-contained: a lot of the editor's everyday interface lives inside our own flagship application instead of inside the shared product. That means any team wanting to adopt the editor has to rebuild large parts of the experience themselves before it becomes usable.

The goal of this work is to make the editor a genuine drop-in product. A new adopter should be able to embed it and immediately get a fully functional spreadsheet experience — menus, side panels, comments, templates, and more — with almost no additional setup.

---

## The Problem We're Solving

Right now, the core spreadsheet engine ships inside the shared product, but most of the surrounding interface does not. Critical pieces of the experience — the side panels, the comment system interface, the toolbar menus, keyboard shortcuts help, and more — only exist inside our own application.

As a result:

- A third-party adopter gets a bare editor and must re-create the rest of the experience from scratch.
- Functionality and design drift apart, because every adopter reinvents the same features differently.
- Maintenance is duplicated: improvements made in one place don't automatically benefit everyone.

We want the shared product to contain everything a typical adopter needs, while still allowing each adopter to add their own application-specific touches on top.

---

## What Moves Into the Shared Product

The following parts of the experience become standard, built-in features of the editor:

- **The side panel system** — the framework that opens, closes, and switches between the panels that appear alongside the spreadsheet.
- **Data validation panel** — where users set rules for what can be entered into cells.
- **Conditional formatting panel** — where users define rules that change how cells look based on their values.
- **Templates panel** — a browsable gallery of ready-made spreadsheet templates a user can start from, including preview cards on hover.
- **Functions / "Learn more" panel** — a reference panel that helps users discover and understand spreadsheet formulas and functions, organized by category.
- **Comments sidebar** — the panel that lists comment threads and lets users read and reply to them.
- **In-cell comment popup** — the small comment interface that appears directly on a cell, including its empty states, input box, comment items, and action menus.
- **Keyboard shortcuts help** — the reference window that lists available keyboard shortcuts.
- **Toolbar menus** — the everyday spreadsheet operation menus (File, Edit, View, Insert, Format, Data, Help) that sit along the top of the editor.

After this work, every adopter gets these for free.

---

## What Stays With Each Adopting Application

Some things are specific to a particular product and should not be forced onto everyone. These stay outside the shared product and remain the responsibility of each adopter:

- **Comment storage and syncing** — how comments are saved, encrypted, shared between collaborators, and kept in sync. The shared product displays comments; it does not dictate how they are stored or transmitted.
- **Application-specific account and identity behavior** — anything tied to a particular app's login, wallet, or user system.
- **App-specific toolbar actions** — sharing, publishing, sign-in controls, collaborator indicators, community links, and the like.
- **Destructive or app-specific sheet actions** — deleting or renaming sheets, creating new documents, and other actions that depend on how a given app manages its files.
- **Real-time collaboration plumbing** — the underlying connection and presence systems specific to each app.

In short: the shared product owns the *interface and interactions*; each adopter owns its own *data, identity, and business-specific actions*.

---

## How Adopters Plug In Their Own Logic

Because the shared product can't know each app's storage or identity rules, it accepts configuration from the adopter:

- **Comments configuration** — the adopter supplies the comment data to display, plus handlers for sending a comment and for actions like resolving, unresolving, or deleting. They can also provide a fallback message shown when a user isn't signed in (for example, "Please log in to comment"). If no comment configuration is provided, the comments feature is simply turned off and comment markers don't appear.
- **Custom panels** — adopters can add their own side panels beyond the built-in ones. They define a panel's identity, title, optional subtitle, width, and content, and the editor handles opening and closing it like any other panel.
- **Navbar composition** — adopters control what sits in the top bar. They can drop in the standard set of spreadsheet menus and then add their own items (document title, share button, etc.) around them.

The guiding principle: sensible defaults out of the box, with clean hooks to extend or override where an adopter genuinely needs to.

---

## Delivery in Three Stages

The work is sequenced so the flagship application keeps working at every step.

### Stage 1 — The Side Panel Foundation

Build the panel system itself inside the shared product first, without yet moving any panel content. This establishes how panels open, close, toggle, switch between one another, remember their state, and behave on mobile and in read-only mode. It also opens up the ability for an adopter to register their own custom panel and trigger it from the toolbar.

**Done when:** an adopter can define a custom panel and open it from a button in the navbar.

### Stage 2 — Panel Contents and Comments

Move the actual content of every built-in panel into the shared product — templates, functions, data validation, conditional formatting — and wire them into the panel system so they work automatically. Move the full comment interface (both the sidebar and the in-cell popup) in as well, driven by the adopter's comment configuration.

This stage also cleans up an older, fragile way the spreadsheet engine used to trigger panels indirectly, replacing it with a direct and reliable connection inside the product. The editor now decides for itself which built-in panels exist: the five standard panels are registered automatically, the comments panel appears only when comment configuration is supplied, and any custom panels an adopter adds are included alongside them.

**Done when:** with just a comment configuration supplied, the comments, templates, data validation, conditional formatting, and functions panels all work with no extra setup.

### Stage 3 — Toolbar Menus

Make the individual spreadsheet menus available as standard, reusable pieces, plus a single convenience bar that bundles all of them together. Adopters can either drop in the whole menu bar or pick individual menus and arrange them however they like.

Each menu keeps its core spreadsheet operations and drops anything app-specific:

- **File menu** — keeps importing and exporting spreadsheets (CSV, XLSX, JSON). Drops app-specific actions like deleting, renaming, sharing, or creating new sheets.
- **Edit menu** — undo, redo, copy, cut, paste, delete rows/columns/values, find and replace.
- **View menu** — freezing rows and columns.
- **Insert menu** — inserting rows and columns, images, links, and opening the functions panel.
- **Format menu** — cell formatting, merging, alignment, text size, borders, and clearing formatting.
- **Data menu** — sorting, filtering, and opening the data validation and conditional formatting panels.
- **Help menu** — keyboard shortcuts and the keyboard reference. Drops app-specific links like community and feedback.

Analytics tracking and authentication checks are stripped out of these menus so they work for any adopter.

**Done when:** a brand-new adopter can stand up a working editor — complete with menus, comments, and a shortcuts window — with a minimal amount of wiring.

---

## Migrating Our Own Application

Once all three stages are complete, the flagship application is updated to *use* the shared product's built-in features instead of its own duplicated copies. The duplicated panels, comment interface, shortcuts window, and most toolbar menus are removed from the app and replaced by the shared versions.

The application keeps only what is genuinely specific to it:

- Its own navbar with app-specific actions.
- Its File menu's app-specific items (such as delete and share) until those are reworked.
- All of its comment storage, syncing, and data-layer logic.
- Its app-specific panels — for example, a smart-contracts panel — added through the same custom-panel mechanism any adopter would use.

This both validates the new design (our own app becomes "just another adopter" for most of the experience) and removes long-standing duplication.

---

## Key Principles and Constraints

- **Framework-agnostic:** the shared product must work in any standard React setting, not just our particular application framework. It must not depend on tooling specific to our app.
- **No new heavy dependencies:** the work should rely on capabilities the product already has, rather than pulling in new ones.
- **Backward compatibility:** existing adopters should not be broken; established options are preserved where they're still relevant.
- **Each stage stands on its own:** the flagship application must remain fully working after every stage, never left in a half-migrated, broken state.
- **Defaults with escape hatches:** everything works out of the box, but adopters can extend with custom panels and compose the navbar to fit their needs.

---

## What Success Looks Like

A new team can embed the spreadsheet editor and, with only a few lines of setup, get:

- A complete toolbar of working spreadsheet menus.
- Side panels for templates, functions, data validation, and conditional formatting — all functional immediately.
- A full commenting experience (sidebar and in-cell), as long as they supply their own comment storage.
- A keyboard shortcuts reference.
- The freedom to add their own panels and navbar items on top.

No re-implementation. No rebuilding the experience. Just a working spreadsheet editor, dropped in.
