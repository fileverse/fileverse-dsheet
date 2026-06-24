# Smart Contracts: Full Package Ownership

**Date:** 2026-06-18
**Status:** Approved
**Revision:** Storage and contract-definition lookup stay with the product. The spreadsheet owns everything else and asks the product for a definition only when it actually needs one.

---

## The Goal

Make smart contract reading work out of the box. Today, any product team that embeds the spreadsheet has to build most of the smart contract experience themselves — the logic that talks to the blockchain, the import flow, the side panel that lists contracts, the intro screen, and the error notices — and wire it all together. This is heavy, error-prone, and repeated by every team.

After this change, the spreadsheet owns the entire user-facing experience and the blockchain reading logic. The product keeps two things it already does well: storing the user's saved contracts, and looking up a contract's full definition when asked. Everything the user sees and does runs automatically inside the spreadsheet.

Because storage stays exactly as it is, there is **no data migration** — existing users' saved contracts keep working untouched.

---

## What Smart Contract Reading Is

It lets a user pull live data from a blockchain smart contract straight into a cell by typing a formula. The user adds a contract once, then references its functions in formulas to read on-chain values. To do this, the spreadsheet needs a way to reach each blockchain network, a list of the contracts the user has saved, and each contract's definition (the description of what functions it has).

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

- **The spreadsheet owns** the full user experience (import flow, contract list panel, intro screen, error notices), the in-memory list state, and the blockchain reading logic.
- **The product owns** storage (where saved contracts physically live and how changes are persisted) and definition lookup (turning a saved contract's stored reference into its full definition).

The spreadsheet keeps no storage of its own. It works from the list the product hands it, and whenever it needs a contract's full definition, it asks the product for it. The product answers from wherever it keeps definitions today. The spreadsheet remembers each answer for the rest of the session, so it only asks once per contract.

---

## The Experience After This Change

Once turned on, the spreadsheet handles the full feature on its own:

- The user can open an import flow to add a contract by giving its address, network, the contract's full definition, and a name.
- Saved contracts appear in a built-in side panel where the user can browse, search, and delete them.
- A set of well-known popular contracts is available to every user automatically, with their definitions already built in — these need no lookup.
- The user types a formula that reads from a saved contract, and the cell fills with the on-chain result.
- If a read fails, the user sees a clear error, and only that cell is affected.
- An intro screen explains the feature to first-time users.

All of this — the import flow, the side panel, the intro, and the error notices — is built in and appears automatically.

---

## How a Product Turns It On

The product supplies one configuration bundle with the following pieces.

### Required: which networks to reach

The product supplies the connection details for each blockchain network it wants to support. It brings its own network access rather than relying on shared defaults, keeping it in control of reliability and usage. Supported networks include Ethereum, Sepolia, Gnosis, and Base.

### Required: the list of saved contracts

The product hands the spreadsheet the contracts the user already has — as lightweight references, not full definitions. Each reference carries the address, network, name, and a pointer to where the definition is stored. The product loads these from wherever it keeps them. This list is small and cheap to provide because it carries no heavy definitions.

### Required: answer a definition lookup

The product provides a way for the spreadsheet to fetch a contract's full definition from its pointer. The spreadsheet calls this only when a formula actually reads that contract, and only once per contract per session. The product answers from its own store. The spreadsheet never reaches into that store itself.

### Required: respond when the user adds or removes a contract

The product provides two responses the spreadsheet calls when the user acts through the built-in interface:

- **On add** — the spreadsheet hands the product the newly imported contract, including its full definition. The product stores it however it likes (for example, saving the definition to its own store and keeping a pointer) and updates the list it provides.
- **On delete** — the spreadsheet tells the product which contract the user removed; the product deletes it and updates the list.

The spreadsheet never persists anything. It asks; the product saves and feeds the updated list back.

### Optional: custom address validation

The spreadsheet always runs basic checks during import — that the address is well-formed and the definition is readable. A product can optionally add its own extra rule (for example, checking an address against its own directory) without rebuilding the rest of the import flow.

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

## How Contract Definitions Are Handled

A contract's definition can be large. Rather than carrying every definition around all the time, the spreadsheet works with lightweight references and fetches the real definition only when it's actually needed.

- The product hands over references — small pointers, not full definitions.
- The first time a formula reads a given contract, the spreadsheet asks the product to resolve that pointer into the full definition, then remembers the answer for the rest of the session.
- Popular built-in contracts skip this entirely — their definitions ship with the spreadsheet.

This keeps storage small, keeps the handover cheap, and means the spreadsheet only ever fetches definitions for contracts the user genuinely uses.

Because the product keeps storing references exactly as it does today, nothing about existing saved data has to change.

---

## No Migration Needed

Products that already offered this feature store their users' contracts as references with a pointer to the definition. This design keeps that exact arrangement. There is nothing to convert, no one-time upgrade step, and no risk to existing user data. Old saved contracts simply keep working.

---

## A Technical Requirement for Embedding Products

Reading from a blockchain depends on a standard blockchain library. To keep the spreadsheet lightweight, that library is not bundled inside it — the embedding product installs it alongside the spreadsheet.

Trade-off to be aware of: because the smart contract feature lives inside the main editor, this library is required by every product that uses the editor, even ones that never use smart contracts. This is a deliberate, accepted trade-off for now. If it proves to be a problem for teams that don't use the feature, the alternative — loading the smart contract machinery only when needed — can be revisited based on their feedback.

---

## What Goes Away

Products that previously embedded the spreadsheet had to provide the blockchain-call logic, manage the saved-contract list and its state, and place the import flow, list panel, intro screen, and error notices themselves. All of that is removed. Those pieces now run automatically inside the spreadsheet.

The import flow changes in one way visible to integrators: when a contract is saved, the spreadsheet hands the product the full definition and lets the product store it however it already does. The spreadsheet itself does no storing and no uploading.

The contract list panel, the import flow, and the intro screen are intentionally **not** customizable by embedding products — keeping them owned and consistent gives every product the same reliable experience.

---

## Trade-offs of This Approach

The product keeps storage and definition lookup, which buys a lot: no migration, no bloated storage, and definitions fetched only for contracts actually used. The costs are modest and bounded:

- The first read of a given contract in a session waits briefly while the product resolves its definition; after that it's instant for the rest of the session.
- If a definition lookup fails (for example, the product's store is unreachable), only that one contract's read shows an error — other contracts are unaffected.
- The feature depends on the product being able to resolve definitions. A product with no definition store of its own could not offer this feature. That is acceptable, because keeping the product's existing storage was the whole point of this design.

---

## Before vs. After (Embedding Product's View)

**Before:** the product built the blockchain-call logic, managed the saved-contract list and its state, wired up the import flow and its open/closed state, supplied the contract list panel, and placed the import flow, intro screen, and error notices itself.

**After:** the product supplies network connection details, hands over the lightweight list of saved contracts, answers a definition lookup when asked, responds when the user adds or deletes one, and optionally adds custom validation and listens to lifecycle events. Everything else — the import flow, the list panel, the intro, the error notices, and the blockchain reading — runs automatically inside the spreadsheet. The product still owns storage and definition lookup; the spreadsheet owns the experience and the execution.
