# Cypher Enterprise Ledger 2.0.0 — Aurora

Complete module package, not an overlay. Modern redesign of v1.9.1 (commit 117796c79d8979b61d6eb7297d4878674429aaca).

## Install
1. Export a ledger backup in your existing installation.
2. Shut down Foundry. Keep a copy of the previous module folder outside Data/modules.
3. Extract this archive so Data/modules/cypher-enterprise-ledger/module.json is directly inside the module folder. Avoid a second version-named wrapper folder.
4. Restart Foundry, enable Cypher Enterprise Ledger in Manage Modules, and reload the world.
5. Open with Alt+L or the scene-control button. Use Workspace tools > Self-test.
6. If using a custom template, clear the custom template path in Module Settings to see the modern dashboard.

## Compatibility
Foundry minimum 14; the prior manifest's verified target 14.369 is retained. This build has not been live-tested inside Foundry. Do not interpret the retained verified field as new runtime certification.

## Design
Graphite/Aurora, Deep Ocean and Obsidian/Violet palettes. Sidebar navigation, metric cards, real-data profit chart, health bars, modern operation panels, local SVG artwork, subtle particles and synthesized sound. Existing theme keys map to the modern palettes without changing stored world settings.

## Data
The v1.9.1 data.mjs rules file is byte-identical to the repository baseline. Schema remains 3. Company settings, weekly PC duties, contracts, routes, branches, intrigue and backup/restore are preserved. This appearance pass does not fix the previously noted rules/security issues. No external fonts or images are downloaded at runtime.

## Limitations
Native Foundry rendering, multi-client sockets, audio autoplay and canvas effects need an in-world smoke test. Optional replacement templates may require adaptation to the new CSS. See VALIDATION.md for the packaging checks.
