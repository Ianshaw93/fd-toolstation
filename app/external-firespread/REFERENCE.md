# External Fire Spread - Reference

## Original Python Project
- **Path:** `C:\Users\IanShaw\localProgramming\fd\external_firespread`
- **Main entry:** `main_efs_gui.py` (tkinter desktop app)

## Tabs in Original App
1. `gui_tab1.py` — Project Details, Building Overview, Area Uses
2. `gui_tab2.py` — Horizontal Means of Escape
3. `gui_tab3.py` — Vertical Means of Escape
4. `gui_tab6.py` — External Fire Spread (BRE 135 calculations)

## Original Excel/VBA Project
- **Path:** `C:\Users\IanShaw\Fire Dynamics Group Dropbox (1)\07 Technical Tools\4. Clever Ideas - External\VBA Shed Fire Strategy\version 5`
- **Main file:** `input_sheet_and_tables_v6.xlsm`
- **Template:** `template_doc_v4.docx`
- 22 sheets total (6 input tabs, calculation/lookup sheets, BR187 radiation tables at 3m–30m)
- VBA modules: `NavigationModule.bas` (validation/flow), `ReportGenerator.bas` (Word report generation)

## Key Files (Python)
- `ext_fs.py` — Calculation engine (`run_efs_calcs`)
- `commercial_data.py` / `residential_data.py` — BRE 135 lookup tables
- `shared_options.py` — Shared dropdown options (area types, booleans)
- `calcs.py` — Standalone calc helpers
