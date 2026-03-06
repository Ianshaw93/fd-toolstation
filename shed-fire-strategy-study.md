# Shed Fire Strategy Tool - Complete Study

## Overview
This is a **Fire Strategy Report (FSR)** generator for warehouse/shed buildings, originally built as an Excel VBA macro tool by "Astute Fire". It takes building inputs across 6 tabs, performs fire engineering calculations per **BS 9999** and **BR 187**, and generates a Word document report.

## Architecture

### Sheet Structure (22 sheets total)

| Sheet | Purpose |
|-------|---------|
| **Start** | Landing page with navigation button |
| **Project** | Project metadata inputs |
| **Building** | Building characteristics & fire safety measures |
| **Horizontal Escape** | Horizontal means of escape data |
| **Vertical Escape** | Vertical means of escape (stairs) |
| **Internal Spread** | Internal fire spread requirements |
| **External Spread** | External fire spread (boundary distances, elevations) |
| **RefData** | Dropdown option lists |
| **Outputs for Report** | 8 report tables assembled from calculations |
| **Number Crunching** | Core calculation engine (545 rows) |
| **BS 9999 Data** | Lookup tables from BS 9999 standard |
| **Br187 Assessment** | BR 187 external fire spread calculations |
| **3m - 30m** | 10 sheets with BR 187 radiation % tables at boundary distances 3m to 30m |

---

## Tab 1: Project (Inputs Only)

| Cell | Field | Type | Example |
|------|-------|------|---------|
| D6 | Project Name | Text | "Sams Warehouse" |
| D8 | Project Location | Text | "Sam Town" |
| D10 | RIBA Design Stage | Dropdown: 3 or 4 | 4 |
| D12 | Engineers Name | Text | "Sam Bennett" |
| D14 | Engineers Initials | Text | "SB" |
| D16 | Client Name | Text | "Maersk" |
| D18 | Astute Office | Dropdown: London/Scotland | "London" |

---

## Tab 2: Building (Inputs)

### Active Fire Safety Measures (top section)
| Cell | Field | Type/Options | Example |
|------|-------|-------------|---------|
| E7 | Sprinkler Protection | Yes/No/Partial | "Yes" |
| E9 | Sprinkler Standard | BS EN 12845 / NFPA (Amazon) | "BS EN 12845" |
| E11 | Fire Alarm & Detection Category | L1/L2/L3/M/Mixed coverage | "L1" |
| E13 | Investigation Period | Yes/No | "No" |
| E15 | Required Fire Resistance Period | 30/60/90/120 (mins) | 60 |

### Uses Table (rows 18-26)
For each of 9 use types (Warehouse, Offices, Store Rooms, Plant Areas, Canteens, Kitchens, Vehicle Maintenance Workshops, Locker Rooms, Changing Rooms):
| Column | Field |
|--------|-------|
| C | Use name (fixed) |
| D | Present? (Yes/No) |
| E | Sprinkler Protection per use (Yes/No) - only if building sprinkler is "Partial" |
| F | FADS Coverage (L1/L2/L3/L4/M) - only if alarm category is "Mixed coverage" |

Row 27 = "Rooftop Plant Areas" (always n/a for sprinkler/FADS)

### Building Characteristics (bottom section)
| Cell | Field | Type | Example |
|------|-------|------|---------|
| E30 | Single Storey Warehouse | Yes/No | "Yes" |
| E32 | Any Multi Storey Areas | Yes/No | "Yes" |
| E34 | Top Storey Height (m) | Numeric | 8.4 |
| E36 | Overall Building Height (m) | Numeric | 17.5 |
| E38 | Overall Building Area (sq m) | Numeric | 31610 |
| E40 | Floor area of Warehouse (sq m) | Numeric | 30740 |
| E42 | High Rack Storage | Yes/No | "Yes" |
| E44 | Vesda in Warehouse | Yes/No | "Yes" |
| E46 | Extended Travel Distances | Yes/No | "Yes" |
| E48 | Max travel distance (m) | Numeric (if E46=Yes) | 70 |

---

## Tab 3: Horizontal Escape (Inputs)

Table with up to 20 rows (rows 8-27):
| Column | Field | Type |
|--------|-------|------|
| C | Area number (1-20) | Auto |
| D | Name | Text (e.g. "Warehouse") |
| E | Use | Dropdown matching Building uses |
| F-Y | Exit widths 1-20 | Numeric (mm), e.g. 800 |

Exit widths must be populated contiguously (no gaps).

---

## Tab 4: Vertical Escape (Inputs)

Table with up to 20 rows (rows 7-26):
| Column | Field | Type |
|--------|-------|------|
| C | Stair Name | Text |
| D | Width (mm) | Numeric |
| E | Number of Floors Served (upper storeys) | Numeric |
| F | Use Served (most onerous) | Dropdown |
| G | Single Stair Access | Yes/No |

---

## Tab 5: Internal Spread (Inputs)

### Top Section
| Cell | Field | Options |
|------|-------|---------|
| D6 | Fire Separation Required | Yes/No |
| D8 | Period of fire resistance (if yes) | 30/60/90/120 |
| D10 | Structural fire engineering to remove passive? | Yes/No |

### Elements Present (rows 15-31)
Each row has D column = Yes/No for whether element is present:
- Stairs protruding from side, Stair Lobbies, Dead End Corridors, Subdivision of Corridors
- Storage <450m², Storage >450m², Workshops
- Kitchens, Changing Areas, Locker Rooms
- Boiler Rooms, MV/HV Electrical Rooms
- Other Plant (High Risk), Other Plant (Low Risk)
- Refuse Storage, Substations

---

## Tab 6: External Spread (Inputs)

| Cell | Field | Type |
|------|-------|------|
| D6 | Number of Elevations | 1-10 |

Table (rows 9-12, columns D-M for elevations 1-10):
| Row | Field | Type |
|-----|-------|------|
| 9 | Boundary Distance (m) | Numeric |
| 10 | ER Height (m) | Numeric |
| 11 | ER Width (m) | Numeric |
| 12 | Sprinkler Protected | Yes/No (auto-filled from building unless "Partial") |

---

## Calculations

### 1. Risk Profile (Number Crunching rows 7-15)

For each present use:
- **Base Risk Profile**: Hardcoded = 3 for all warehouse uses (column G)
- **Final Risk Profile**: `IF(sprinklered, base-1, base)` → column H gives 1, 2, or 3
- **Detection as Number**: L1=1, L2=2, L3=3, M=4
- **Minimum Required Detection**: `IF(risk=3, 2, 4)` — risk 3 needs at least L2
- **Enhanced Detection**: `IF(detection_number < min_required, "Yes", "No")`
- Risk profile output: "A" + final_risk_profile number (e.g. "A2")

### 2. Travel Distances (Number Crunching → BS 9999 Data)

From BS 9999 Table:
| Risk Profile | Single Direction | Multiple Direction |
|-------------|-----------------|-------------------|
| A1 | 26m | 65m |
| A2 | 22m | 55m |
| A3 | 18m | 45m |

**With enhanced detection**: distances increased by 15% (×1.15, rounded down to 0.1m)

### 3. Exit Width Factors (BS 9999 Data)

| Risk Profile | Without Enhanced | With Enhanced (×0.85) |
|-------------|-----------------|----------------------|
| A1 | 3.3 mm/person | ~2.81 |
| A2 | 3.6 mm/person | ~3.06 |
| A3 | 4.6 mm/person | ~3.91 |

**Allowed occupancy if exit < 1050mm**: `ROUNDDOWN(500 / exit_width_factor)`
**mm/person if exit > 1050mm**: the factor itself

### 4. Vertical Escape (Number Crunching rows 19-38)

Stair capacity calculation using BS 9999 occupancy factors:
- Factors vary by risk profile (1/2/3) and number of floors served (1-10)
- Without enhanced detection: direct lookup from table
- With enhanced detection: factors × 0.85 (rounded down)
- **Stair Capacity** = stair_width / occupancy_factor

### 5. Exit Width Calculations (Number Crunching rows 42-61, 526-545)

For each horizontal escape area:
- Aggregates exit widths
- Calculates maximum allowable occupancy based on exit width factor
- Considers discounting (removing largest exit for safety)

### 6. Internal Fire Spread (BS 9999 Data rows 29-50)

Fire resistance periods for each element of construction:
- Most elements: 30 min fixed
- Loadbearing elements, external walls: = Building fire resistance period
- Storage >450m², Boiler rooms, MV/HV electrical, Refuse: `MAX(60, building_fire_res)`
- Substations: always 120 min
- High risk workshops/plant: 60 min fixed

### 7. External Fire Spread / BR 187 Assessment

**Enclosing Rectangle** approach:
1. Takes boundary distance, ER height, ER width per elevation
2. Rounds up to BRE standard sizes (3,6,9,...30m height; 3,6,9,...130m width)
3. Looks up **unprotected area percentage** from BR 187 tables
4. If sprinklered: boundary distance is doubled (×2) for lookup
5. Each "Xm" sheet (3m, 6m, ..., 30m) contains a radiation percentage lookup table:
   - Rows = BRE width categories (3-130m)
   - Columns = percentage thresholds (20-100%)
   - Values = required boundary distances
6. Interpolation between table values when exact match not found
7. **Result**: Max % of facade that can be unprotected openings
8. `Unprotected Area Allowed (m2) = percentage × MAX(ER_area, BRE_area)`
9. `Walls Require Fire Resistance?` = "Yes" if allowed_area < ER_area

---

## Report Generation (VBA)

The VBA code:
1. Opens a Word template (`template_doc_v4.docx`)
2. Sets document properties (project name, client, engineer, etc.)
3. Processes bookmarks to conditionally show/hide report sections based on inputs
4. Populates 8+ Word tables from the "Outputs for Report" sheet
5. Key conditional sections:
   - Sprinkler sections (Yes/No/Partial variations)
   - High rack storage section
   - Fire alarm type sections (Manual/L1-L3/Mixed)
   - Extended travel distance sections
   - Single storey vs multi storey sections
   - Passive fire protection sections
   - External fire spread assessment tables (split across 2 Word tables if >7 elevations)

### Named Ranges Used

| Name | Points To | Description |
|------|-----------|-------------|
| Sprinker_Protection | Building!E7 | Sprinkler protection type |
| Sprinkler_Standard | Building!E9 | BS EN 12845 or NFPA |
| Alarm_Category | Building!E11 | Detection category |
| Investigation_Period | Building!E13 | Investigation period required |
| FireResPeriod | Building!E15 | Fire resistance period |
| Single_Storey_Warehouse | Building!E30 | Single storey? |
| Any_Multi_Storey | Building!E32 | Multi storey areas? |
| Building_Height | Building!E36 | Overall height |
| Building_Area | Building!E38 | Overall area |
| High_Rack_Storage | Building!E42 | High rack storage? |
| Vesda_Warehouse | Building!E44 | VESDA installed? |
| Extended_Travel | Building!E46 | Extended travel? |
| Max_Travel_Distance | Building!E48 | Max travel distance |
| PassiveFireProtection | Internal Spread!D10 | Passive fire protection? |
| Number_Elevations | External Spread!D6 | Number of elevations |
| Boundary_Distances | External Spread!D9:M9 | All boundary distances |
| Project_Name | Project!D6 | Project name |
| Client_Name | Project!D16 | Client name |
| Engineers_Name | Project!D12 | Engineer name |
| Engineers_Initials | Project!D14 | Engineer initials |
| RIBA_Design_Stage | Project!D10 | RIBA stage |
| Astute_Office | Project!D18 | Office location |
| Side_Stairs | Internal Spread!D15 | Side stairs present? |
| Workshops | Internal Spread!D21 | Workshops present? |
| Warehouse_Risk | Outputs!C5 | Warehouse risk profile |
| Warehouse_FADS | Building!F18 | Warehouse FADS category |

---

## Existing Python Project (Other Claude Instance)

The other Claude instance can see tabs 1, 2, 3, and 6 (Project, Building, Horizontal Escape, External Spread). Missing:
- **Tab 4**: Vertical Escape
- **Tab 5**: Internal Spread

These need to be added to bring the Python version to parity.

## Standards Referenced
- **BS 9999** - Fire safety in the design, management and use of buildings (risk profiles, travel distances, exit widths, compartmentation)
- **BR 187** - External fire spread: building separation and boundary distances (BRE method for unprotected areas)
- **BS EN 12845** - Sprinkler systems
- **NFPA** - National Fire Protection Association standards (Amazon projects)
