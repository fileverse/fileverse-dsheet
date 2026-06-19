# Smart Contracts: Full Package Ownership

**Date:** 2026-06-18
**Status:** Approved

---

## The Goal

Make smart contract reading work out of the box. Today, any product team that embeds the spreadsheet has to build most of the smart contract experience themselves — the logic that talks to the blockchain, the import flow, the side panel that lists contracts, the intro screen, and the error notices — and wire it all together. This is heavy, error-prone, and repeated by every team.

After this change, the spreadsheet owns the entire user-facing experience and the blockchain reading logic. The product team keeps ownership of one thing only: where saved contracts are stored. It supplies which networks to reach, hands the spreadsheet the list of saved contracts it already has, and responds when the user adds or removes one. Everything the user sees and does runs automatically inside the spreadsheet.

---

## What Smart Contract Reading Is

It lets a user pull live data from a blockchain smart contract straight into a cell by typing a formula. The user adds a contract once, then references its functions in formulas to read on-chain values. To do this, the spreadsheet needs a way to reach each blockchain network and a list of the contracts the user has saved.

---

## The Problem Today

To offer smart contract reading, an embedding product currently has to:

- Build the logic that makes the blockchain call and returns the result
- Manage the list of saved contracts and keep its state in sync
- Build and wire up the contract import flow
- Build and place the side panel that lists the user's contracts
- Build the intro screen and the error notifications

Every team that wants this feature rebuilds the same machinery, and any gap degrades the experience.

---

## The Ownership Split

This is the core idea of the change:

- **The spreadsheet owns** the full user experience (import flow, contract list panel, intro screen, error notices) and the blockchain reading logic.
- **The product owns** storage — where saved contracts physically live, and persisting changes to them.

The spreadsheet keeps no storage of its own and no hidden state about contracts. It always works from the list the product hands it. When the user adds or deletes a contract through the built-in interface, the spreadsheet tells the product, the product saves the change and updates the list it provides, and the spreadsheet reflects the new list. The product is the single source of truth for contract data; the spreadsheet drives everything around it.

---

## The Experience After This Change

Once turned on, the spreadsheet handles the full feature on its own:

- The user can open an import flow to add a contract by giving its address, network, the contract's interface definition, and a name.
- Saved contracts appear in a built-in side panel where the user can browse, search, and delete them.
- A set of well-known popular contracts is available to every user automatically, without anyone having to add them.
- The user types a formula that reads from a saved contract, and the cell fills with the on-chain result.
- If a read fails, the user sees a clear error.
- An intro screen explains the feature to first-time users.

All of this — the import flow, the side panel, the intro, and the error notices — is built in and appears automatically.

---

## How a Product Turns It On

The product supplies one configuration bundle with the following pieces.

### Required: which networks to reach

The product supplies the connection details for each blockchain network it wants to support. It brings its own network access rather than relying on shared defaults, keeping it in control of reliability and usage. Supported networks include Ethereum, Sepolia, Gnosis, and Base.

### Required: the list of saved contracts

The product hands the spreadsheet the contracts the user already has. The product loads these from wherever it keeps them and provides them ready to use, with each contract's full interface definition included. The spreadsheet does not fetch or store these itself — it simply reads the list it is given.

### Required: respond when the user adds or removes a contract

The product provides two responses the spreadsheet calls when the user acts through the built-in interface:

- **On add** — the spreadsheet hands the product a newly imported contract; the product saves it and updates the list it provides.
- **On delete** — the spreadsheet tells the product which contract the user removed; the product deletes it and updates the list.

The spreadsheet never persists anything. It asks; the product saves and feeds the updated list back.

### Optional: a notification stream

The product can subscribe to a single stream of lifecycle events for its own analytics or error logging. The events cover:

- **Query success** — a contract read succeeded
- **Query error** — a contract read failed
- **Contract added** — the user saved a new contract
- **Contract deleted** — the user removed a contract

Each event carries useful context where relevant: the contract name, the function read, the network, and an error description on failure. This is entirely optional.

### When the feature is off

If a product supplies no smart contract configuration at all, the feature is cleanly disabled: the smart contract button is hidden from the toolbar, and any formula that tries to read a contract shows a clear "feature disabled" indicator. Nothing breaks.

---

## How Contract Definitions Are Handled Now

Previously, a contract's interface definition was not kept with the contract — only a pointer to it stored on a separate distributed file system was kept, and the spreadsheet had to go fetch the real definition before it could run anything. The spreadsheet can no longer do that fetch on its own.

The change is to keep the full interface definition together with the contract itself. Each contract the product hands over already carries its complete definition alongside its address, network, and name. Reading from a contract no longer requires any extra lookup — everything needed is already on hand. This makes reads simpler and more reliable.

Because resolving definitions is no longer the spreadsheet's job, the product is responsible for making sure each contract it provides already includes its full definition.

---

## Migration for Existing Users

Products that already offered this feature have users whose saved contracts only hold the old pointer, not the full definition. Those products need a one-time migration: on load, detect contracts saved the old way, fetch their full definitions once, replace the pointers with the real definitions, and save them back in the new format. After that, the product hands the spreadsheet a clean list with full definitions, and everything runs without further lookups. This migration is the embedding product's responsibility, not the spreadsheet's.

---

## A Technical Requirement for Embedding Products

Reading from a blockchain depends on a standard blockchain library. To keep the spreadsheet lightweight, that library is not bundled inside it — the embedding product installs it alongside the spreadsheet.

Trade-off to be aware of: because the smart contract feature lives inside the main editor, this library is required by every product that uses the editor, even ones that never use smart contracts. This is a deliberate, accepted trade-off for now. If it proves to be a problem for teams that don't use the feature, the alternative — loading the smart contract machinery only when needed — can be revisited based on their feedback.

---

## What Goes Away

Products that previously embedded the spreadsheet had to provide the blockchain-call logic and manage the import flow's open/closed state themselves. Both of those responsibilities are removed. The import flow, the contract list panel, the intro screen, and the error notices are no longer something the product builds or places — they all run automatically inside the spreadsheet.

The import flow also changes in one way visible to integrators: when a contract is saved, the spreadsheet now hands the product the full contract definition directly, rather than the product uploading it to a distributed file system and keeping a pointer.

The contract list panel, the import flow, and the intro screen are intentionally **not** customizable by embedding products — keeping them owned and consistent gives every product the same reliable experience.

---

## Before vs. After (Embedding Product's View)

**Before:** the product built the blockchain-call logic, managed the saved-contract list and its state, wired up the import flow and its open/closed state, supplied the contract list panel, and placed the import flow, intro screen, and error notices itself.

**After:** the product supplies network connection details, hands over the list of saved contracts, responds when the user adds or deletes one, and optionally listens to lifecycle events. Everything else — the import flow, the list panel, the intro, the error notices, and the blockchain reading — runs automatically inside the spreadsheet. The product still owns storage; the spreadsheet owns the experience and the execution.
