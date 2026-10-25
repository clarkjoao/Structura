# Spec Delta

## ADDED Requirements

### Requirement: Plugins can offer workspace imports

The host SHALL list each registered workspace importer in the workspace home's Import, run it from
the user's click with the locale and the current workspace folder, open the diagram it names, and
open the `document-pane` panel it names only when that panel belongs to the same plugin. A failed
run SHALL show its message and change nothing else in the UI.

#### Scenario: An import opens its diagram and pane

- **GIVEN** a plugin whose workspace importer returns `{ diagramId, openPane }`
- **WHEN** the user picks it in Import on the workspace home
- **THEN** the modal closes, the diagram opens, and the plugin's pane opens beside it

### Requirement: An opscr folder is set up in one pick

The opscr plugin's workspace importer SHALL create a workspace folder named after the Product,
create the main diagram in it bound to the picked folder, switch on a diagram for each View when the
root declares Views, and open the opscr pane, which SHALL open the folder without asking for it
again. Picking a folder imported before SHALL open the diagram made for it.

#### Scenario: Importing the web-shop product

- **GIVEN** the `web-shop-product` example folder
- **WHEN** the user imports it from the home
- **THEN** a workspace folder "Web shop" holds the "Web shop" diagram and the four View diagrams,
  the diagram draws the folder, and the initiative `order-events` is one of its Versions

#### Scenario: Importing the same folder again

- **WHEN** the user imports the same folder again
- **THEN** no diagram or folder is created and the "Web shop" diagram opens
