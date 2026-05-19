# Arknights: Endfield Originium Circuitry Solver Requirements

## Goal

Create a web tool that solves Arknights: Endfield's Originium Circuitry / Repair Logic puzzle from screenshot-recognized or manually corrected board data and piece shapes.

## Target Puzzle

Public guides describe the puzzle as a Tetris-like repair puzzle:

- A board/grid is shown on the left.
- Repair Logic pieces are shown on the right.
- The board has row and/or column requirements indicating how many cells of each color must appear.
- Pieces can be rotated and placed into the board.
- Some cells may be unavailable or already occupied.
- Some puzzles use multiple colors.

## MVP Scope

- Manual board input.
- Screenshot/image-assisted input.
- Manual row and column requirement input.
- Manual piece-shape input.
- Support multiple colors.
- Support unavailable cells.
- Support prefilled/fixed occupied cells.
- Solve and show all solutions or the first N solutions.
- Render the solution visually in the browser.

## Out of Scope for MVP

- Game asset reproduction.
- Online account features.
- Backend server.

## Input Data

### Board

- Width and height.
- Cell state:
  - empty
  - unavailable
  - fixed occupied cell with color id
  - blocked/immovable board cell where no new piece can be placed

Note: fixed cells need two separate concepts:

- Existing occupied block: an immovable colored block already on the board. It counts toward row/column requirements.
- Blocked placement cell: a cell where pieces cannot be placed.

Blocked placement cells only count toward requirements when they are colored. If a blocked/unavailable cell has no color, it does not affect row/column requirements.

### Requirements

- For each color:
  - column counts, length = board width
  - row counts, length = board height
- Multi-color puzzles are supported. Each color has its own row/column requirement set.
- The app targets shape/figure view only. Number view is not supported.
- Row/column requirements are extracted by counting the small colored bars shown in shape/figure view.

### Pieces

- Piece id/name.
- Shape as a small matrix.
- Per-cell color id.
- Rotation allowed.
- Reflection/mirroring is not allowed.
- Quantity default: each listed piece is used once.
- Duplicate pieces with the same shape and color can appear and must be treated as separate required pieces.

## Solving Rules

- Every required piece must be placed exactly once.
- Every available piece must be used.
- A piece cannot overlap another piece, unavailable cell, or conflicting fixed cell.
- A piece cannot extend outside the board.
- Rotations are allowed in 90-degree steps: 0, 90, 180, and 270 degrees.
- Reflection is not allowed.
- Final board must match row and column requirements for every color.
- Existing fixed cells count toward row and column requirements.
- Colorless blocked cells do not count toward row and column requirements.
- Placing a piece on top of an existing fixed colored cell is impossible.

## Algorithm

1. Normalize board, requirements, and piece matrices.
2. Generate unique rotations for each piece.
3. Generate all valid placements for each rotated piece.
4. Use backtracking / exact-cover style search:
   - choose the next piece or most constrained piece
   - place candidate
   - update occupied cells and row/column counts
   - prune when any count exceeds a requirement or can no longer reach it
5. Return first solution or multiple solutions.

## Internal Data Format

The solver receives one independent puzzle unit at a time. Multi-page in-game puzzles are represented as separate puzzle objects.

```json
{
  "version": 1,
  "source": {
    "type": "screenshot",
    "imageName": "example.png",
    "unitLabel": "1/3"
  },
  "colors": [
    {
      "id": "green",
      "label": "Green",
      "hex": "#a7e900"
    },
    {
      "id": "blue",
      "label": "Blue",
      "hex": "#39a9f2"
    }
  ],
  "board": {
    "width": 6,
    "height": 6,
    "cells": [
      ["empty", "blocked", "empty", "empty", "empty", "empty"],
      ["empty", "empty", "fixed:green", "empty", "blocked", "empty"]
    ]
  },
  "requirements": {
    "rows": {
      "green": [2, 3, 5, 4, 5, 3],
      "blue": [0, 0, 0, 0, 0, 0]
    },
    "columns": {
      "green": [1, 2, 4, 3, 4, 5],
      "blue": [0, 0, 0, 0, 0, 0]
    }
  },
  "pieces": [
    {
      "id": "p1",
      "color": "green",
      "cells": [
        [1, 1, 0],
        [0, 1, 1]
      ],
      "rotation": true,
      "mirror": false
    },
    {
      "id": "p2",
      "color": "green",
      "cells": [
        [1, 1, 0],
        [0, 1, 1]
      ],
      "rotation": true,
      "mirror": false
    }
  ]
}
```

### Cell Encoding

For UI storage, cells can use string values:

- `"empty"`: piece can be placed here.
- `"blocked"`: piece cannot be placed here and no color is counted.
- `"fixed:<colorId>"`: occupied by an immovable color cell and counted toward requirements.

For the solver, normalize these into structured cells:

```ts
type BoardCell =
  | { kind: "empty" }
  | { kind: "blocked" }
  | { kind: "fixed"; color: string };
```

### Requirement Encoding

Requirements are final counts per row/column per color.

- Fixed colored cells are included in the final count.
- Empty blocked cells are not included.
- If a color has no required cells in a row or column, use `0`.
- The data model supports any number of colors, even though current examples show up to 2.

### Piece Encoding

Each piece object is a required individual piece.

- Duplicate pieces are represented as separate objects with different ids.
- `cells` uses `1` for occupied cells and `0` for empty bounding-box cells.
- A piece currently has a single color. If future puzzles contain multi-color pieces, extend occupied cells from `1` to color ids.
- `rotation: true` means generate 0/90/180/270 degree rotations.
- `mirror` must remain `false`.

## Solver Specification

### Normalization

1. Validate board width and height.
2. Validate every requirement array length.
3. Validate every color referenced by cells, requirements, and pieces.
4. Convert board cells into structured cells.
5. Count fixed cells per row/column/color.
6. Reject puzzles where fixed counts already exceed requirements.
7. Validate that total required remaining cells per color equals total piece cells per color.

### Rotation Generation

For each piece:

1. Generate 0, 90, 180, and 270 degree rotations.
2. Trim empty rows/columns around each rotated matrix.
3. Remove duplicate rotations for symmetric pieces.
4. Do not generate mirrored variants.

### Placement Generation

For each rotated piece:

1. Slide the piece over every board position where its bounding box fits.
2. Reject positions where any occupied piece cell maps to:
   - a blocked board cell
   - a fixed colored cell
   - an already occupied cell during search
3. Precompute row/column/color contribution for that placement.

### Search

Use depth-first backtracking.

At each step:

1. Choose the unplaced piece with the fewest currently valid placements.
2. Try each placement.
3. Update occupied cells.
4. Update remaining row/column/color counts.
5. Prune immediately when any count goes below 0.
6. Prune when remaining unplaced pieces cannot satisfy a row/column/color count.
7. Stop after the requested solution limit.

### Output

Return:

```json
{
  "status": "solved",
  "solutions": [
    {
      "placements": [
        {
          "pieceId": "p1",
          "rotation": 90,
          "x": 2,
          "y": 3
        }
      ],
      "board": [
        ["green", "green", "blocked"]
      ]
    }
  ],
  "stats": {
    "solutionsFound": 1,
    "searchedNodes": 120,
    "elapsedMs": 8
  }
}
```

Possible statuses:

- `"solved"`
- `"no_solution"`
- `"invalid_input"`
- `"limit_reached"`

## UI Requirements

- Japanese UI.
- Image upload area for screenshot recognition.
- Manual correction after recognition.
- Board size controls.
- Board editor:
  - paint empty/unavailable/fixed color cells
  - row and column count inputs
- Piece editor:
  - add/remove piece
  - edit mini-grid shape and colors
  - preview rotations
- Solve button.
- Result area:
  - solution count
  - first solution visual board
  - previous/next solution controls
  - piece labels/colors visible
- Import/export puzzle as JSON for sharing and debugging.

## Image Recognition Requirements

The tool must support uploading shape/figure-view screenshots and extracting puzzle data.

Number-view screenshots are not supported.

### Recognition Targets

- Board grid size and cell boundaries.
- Cell states:
  - empty
  - unavailable/blocked
  - fixed colored occupied cells
- Row and column requirement bars in shape/figure view.
- Display mode validation:
  - accept shape/figure view
  - reject or warn on number view
- Available piece shapes.
- Piece colors.

### Recognition Workflow

1. User uploads screenshot.
2. App detects candidate board area and piece area.
3. App validates that the screenshot is in shape/figure view.
4. App extracts board size, colored cells, blocked cells, and visible row/column requirement bars.
5. App extracts piece matrices from the piece panel.
6. App shows a confirmation/edit screen.
7. User corrects recognition mistakes manually.
8. Solver runs from the confirmed structured data.

### Recognition Strategy

- Start with browser-side image processing.
- Prefer deterministic computer vision first:
  - crop regions
  - grid detection
  - color sampling
  - thresholding for blocked/empty cells
- Because screenshots can vary by resolution, UI scale, language, and compression, manual correction is required even after recognition.
- Since number view is not supported, requirements are recognized by detecting and counting colored bar glyphs next to rows and columns.

### Screenshot Observations

From sample screenshots:

- The board can appear as a square grid with diagonal cell markings.
- Row requirements are displayed on the left side of the board.
- Column requirements are displayed above the board.
- Requirements are shown as small colored bars in shape view. The number of bars equals the required final cell count for that color in that row/column.
- Two-color puzzles show bar stacks in multiple colors, such as blue and yellow-green.
- The right panel contains available pieces as small cards.
- Available pieces can be single-color and may use different colors, such as cyan/teal or yellow-green/orange.
- Locked/fixed cells can show a lock icon and a colored square.
- Empty blocked/unavailable cells can be gray/dark and should not count toward requirements unless colored.
- Existing colored fixed blocks occupy cells and count as already placed colored cells.
- Confirmed examples currently show up to 2 colors, but the internal data model must support 3 or more colors for future content.
- Some puzzles span multiple unit pages, such as 1/3, 2/3, 3/3. Each unit/page is an independent puzzle.
- Completed-solution screenshots are useful validation samples because the final colored cell counts can be compared against the visible row/column bars.

## Information Needed Before Implementation

- Typical and maximum board sizes in the game.
- Whether more than 2 colors appear in later game content.
- Maximum number of pieces.
- Typical screenshot layout and UI scale.
- Sample screenshots for:
  - single-color puzzle
  - multi-color puzzle
  - puzzle with fixed occupied blocks
  - puzzle with blocked cells
  - puzzle with missing/unknown pieces if that appears in-game
