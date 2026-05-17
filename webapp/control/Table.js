sap.ui.define([
    "sap/ui/core/Control",
    "sap/ui/table/Table",
    "sap/ui/table/Column",
    "sap/m/Text",
    "sap/m/Button",
    "sap/m/Toolbar",
    "sap/m/Dialog",
    "sap/m/IconTabBar",
    "sap/m/IconTabFilter",
    "sap/m/List",
    "sap/m/CustomListItem",
    "sap/m/HBox",
    "sap/m/VBox",
    "sap/m/CheckBox",
    "sap/m/Input",
    "sap/m/Select",
    "sap/m/Switch",
    "sap/ui/core/Item",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Sorter",
    "sap/ui/model/Filter"
], function (Control, UITable, Column, Text, Button, Toolbar, 
    Dialog, IconTabBar, IconTabFilter, List, CustomListItem, HBox, VBox, CheckBox, 
    Input, Select, Switch, Item, JSONModel, Sorter, Filter) {
    "use strict";

    return Control.extend("com.grid.alvdemo.control.Table", {

        metadata: {
            properties: {
                title: "string"
            },
            aggregations: {
                _table: {
                    type: "sap.ui.table.Table",
                    multiple: false,
                    visibility: "hidden"
                }
            }
        },

        init: function () {

            this._stateModel = new JSONModel({columns: [], sort: [], filter: [], group: []});
            this._originalState = JSON.stringify({columns: [], sort: [], filter: [], group: []});
            this._variantModel = new sap.ui.model.json.JSONModel({
                variants: [],
                selected: ""
            });

            this._createTable();

            this._loadVariantsToModel();

            this.setModel(this._variantModel, "variant");

            this._stateModel.attachPropertyChange(() => {
                this._updateDirtyFlag();
            });
            this._uiStateModel = new sap.ui.model.json.JSONModel({
                isDragging: false
            });

            this.setModel(this._uiStateModel, "ui");

            this._viewModel = new sap.ui.model.json.JSONModel({
                selectedColumnKey: null,
                selectedColumn: null
            });

            this.setModel( this._viewModel, "viewModel");

            // ✅ APPLY DEFAULT VARIANT
            const defaultKey = this._variantModel.getProperty("/selected");
            if (defaultKey) {
                this._loadVariant(defaultKey);
            }
          
           // ✅ ATTACH ALV COLUMN SELECTION DELEGATE
            const oTable = this.getAggregation("_table");
            if (oTable) {
                oTable.addEventDelegate({
                    onclick: (oEvent) => {
                       // debugger;
                       let oClickedControl = oEvent.srcControl ? oEvent.srcControl : null;
                       if (!oClickedControl) {
                            // Fallback if UI5 proxy mapping hasn't initialized on target yet
                            const sNearestId = jQuery(oEvent.target).closest("[data-sap-ui]").attr("id");
                            if (sNearestId) {
                                oClickedControl = sap.ui.getCore().byId(sNearestId);
                            }
                        }
                        if (!oClickedControl) return;

                        // 2. Bubble up to find the main Column instance wrapper
                        let oColumn = oClickedControl;
                        while (oColumn && oColumn.getMetadata().getName() !== "sap.ui.table.Column") {
                            oColumn = oColumn.getParent ? oColumn.getParent() : null;
                        }
                        // 3. Extract the names if a valid column was found
                        if (oColumn) {
                            // A. Get the Technical Field Name (e.g., "Department", "Salary")
                            const sTechnicalName = this._getColumnTechnicalName(oColumn);
                            this._viewModel.setProperty("/selectedColumnKey", sTechnicalName);
                            this._viewModel.setProperty("/selectedColumn", oColumn);
                            // B. Get the Visible Header Label UI text (e.g., "Cost Center Department")
                            const sVisibleLabel = this._getColumnVisibleLabel(oColumn);

                            console.log("Technical Name:", sTechnicalName);
                            console.log("Visible Label Name:", sVisibleLabel);

                            // Run your highlight matrix or filter logic below...
                            this._selectALVColumn(oColumn, oTable);
                            sap.m.MessageToast.show("Clicked column name: " + sTechnicalName);
                        }
                        
                         // Highlight the entire vertical column span!
                       // this._selectALVColumn("Name", oTable);
                    }});
                }
        },

        /**
         * Wraps column text and a filter status icon into a unified HBox container
         * @param {string} sLabelText - The display text for the column header
         * @param {string} sColumnKey - The technical property path (e.g., "Department")
         * @returns {sap.m.HBox} The layout container to pass to oColumn.setLabel()
         */
        _createALVHeaderLabel: function (sLabelText, sColumnKey) {
            // 1. Create the text component
            const oText = new sap.m.Text({
                text: sLabelText,
                wrapping: false
            }).addStyleClass("alvHeaderLabelText");

            // 2. Create the filter icon (using standard SAPUI5 filter glyph)
            const oFilterIcon = new sap.ui.core.Icon({
                src: "sap-icon://filter",
                size: "0.85rem",
                color: "#1d2d3d", // Neutral standard dark gray tint
                visible: false,   // ⚠️ Hidden by default, toggled true when active filter state applies
                tooltip: "Filtered by this column"
            }).addStyleClass("alvHeaderFilterIcon sapUiTinyMarginBegin");

            // 3. Optional click handle on the icon itself if you want a separate reaction
            oFilterIcon.attachPress((oEvent) => {
                oEvent.cancelBubble(); // Keep the header click handler from misfiring
                sap.m.MessageToast.show("Filter configuration for " + sColumnKey);
            });

            // 4. Combine into an HBox with center vertical alignment
            const oHeaderBox = new sap.m.HBox({
                alignItems: "Center",
                justifyContent: "Start",
                renderType: "Bare",
                items: [oText, oFilterIcon]
            });

            // Store references on the box container so we can extract them easily later
            oHeaderBox.data("columnKey", sColumnKey);
            oHeaderBox.data("filterIcon", oFilterIcon);

            return oHeaderBox;
        },
        

        /**
         * Resolves the UI text string printed onto the header (e.g., "Department")
         */
        _getColumnVisibleLabel: function (oColumn) {
            const oHeader = oColumn.getLabel(); // Usually returns a sap.m.Label or sap.m.Text
            if (oHeader) {
                if (typeof oHeader.getText === "function") {
                    return oHeader.getText();
                }
                if (typeof oHeader.getValue === "function") {
                    return oHeader.getValue();
                }
            }
            return "Unknown Column";
        },
    _selectALVColumn: function (oColumn, oTable) {
       if (!oColumn || !oTable) return;

        // 1. Clear out global structural flags and artifacts using jQuery
        oTable.$().removeClass("alvSelectedColumn");
        oTable.$().find(".alvHighlightCol").removeClass("alvHighlightCol");
        oTable.$().find(".alvHighlightHeader").removeClass("alvHighlightHeader");

        // 2. Identify visual layout sequence position 
        const aVisibleColumns = oTable.getColumns().filter(col => col.getVisible());
        const iColIndex = aVisibleColumns.findIndex(col => col.getId() === oColumn.getId());

        if (iColIndex === -1) return;

        // 3. Persist matching values into our data baseline model
        const sTechnicalName = this._getColumnTechnicalName(oColumn);
        this._viewModel.setProperty("/selectedColumnKey", sTechnicalName);
        this._viewModel.setProperty("/selectedColumn", oColumn);

        // 4. Highlight the targeted table header cell block directly
        const sColumnId = oColumn.getId();
        jQuery("#" + sColumnId).addClass("alvHighlightHeader");
        oTable.$().find("th[data-sap-ui-colid='" + sColumnId + "']").addClass("alvHighlightHeader");

        // 5. Enable the visual boundary rules
        oTable.$().addClass("alvSelectedColumn");

        // 6. Instantly color the current viewport records
        this._highlightVisibleDomCells(oTable, iColIndex);
    },

    /**
     * Robust helper method to safely resolve the technical field name (binding path) of a column
     */
    _getColumnTechnicalName: function (oColumn) {
        // Strategy 1: Check standard UI5 sort/filter metadata mapping keys
        let sKey = oColumn.getSortProperty() || oColumn.getFilterProperty();

        // Strategy 2: Fallback to reading the bound template data path configuration
        if (!sKey && oColumn.getTemplate()) {
            const oTemplate = oColumn.getTemplate();
            const oBindingInfo = oTemplate.getBindingInfo("text") || oTemplate.getBindingInfo("value");
            if (oBindingInfo && oBindingInfo.parts && oBindingInfo.parts.length > 0) {
                sKey = oBindingInfo.parts[0].path;
            }
        }

        // Strategy 3: Hard fallback to trimming control specific ID structures
        if (!sKey) {
            sKey = oColumn.getId().split("--").pop();
        }

        return sKey;
    },

    _highlightVisibleDomCells: function (oTable, iColIndex) {
          if (!oTable || iColIndex === -1) return;

        // 1. Get the target column instance from the visible columns list
        const aVisibleColumns = oTable.getColumns().filter(col => col.getVisible());
        const oColumn = aVisibleColumns[iColIndex];
        if (!oColumn) return;

        // 2. Extract its unique runtime control ID (e.g., "__column2")
        const sColumnId = oColumn.getId();

        // 3. Clear all old column cell highlights across the entire table DOM
        oTable.$().find("td.alvHighlightCol").removeClass("alvHighlightCol");

        // 4. Target the specific vertical line cells by finding rows in both fixed and scrollable sides
        oTable.$().find(".sapUiTableCtrlTr").each(function () {
            const $row = jQuery(this);

            // Find the cell that points explicitly to our column ID mapping attribute
            let $targetCell = $row.find("td[data-sap-ui-colid='" + sColumnId + "']");

            // Fallback Strategy: If your UI5 library version strips the data-sap-ui-colid parameter, calculate via index
            if ($targetCell.length === 0) {
                const bHasRowSelectors = oTable.getSelectionMode() !== "None";
                
                // Check if this row belongs to the fixed table split or the scrollable table split
                const bIsFixedTable = $row.closest(".sapUiTableCtrlScrFix").length > 0;
                const iFixedCount = oTable.getFixedColumnCount();

                if (bIsFixedTable) {
                    // If it's in the fixed side, accounting for checkboxes on the far left
                    if (iColIndex < iFixedCount) {
                        const iRealDomIndex = bHasRowSelectors ? iColIndex + 1 : iColIndex;
                        $targetCell = $row.children("td").eq(iRealDomIndex);
                    }
                } else {
                    // If it's in the scrollable text split side, offset by the fixed columns count
                    if (iColIndex >= iFixedCount) {
                        const iRealDomIndex = iColIndex - iFixedCount;
                        $targetCell = $row.children("td").eq(iRealDomIndex);
                    }
                }
            }

            // Apply high-priority background classes
            $targetCell.addClass("alvHighlightCol");
        });
        },
        _onCellClick: function (oEvent) {
            // Row index -1 usually indicates the header area in sap.ui.table.Table
            const iRowIndex = oEvent.getParameter("rowIndex");
            
            if (iRowIndex === -1) {
                const oColumn = oEvent.getParameter("column");
                if (!oColumn) return;

                // Get the field name from the binding path
                const oTemplate = oColumn.getTemplate();
                let sColumnKey = "";

                if (oTemplate) {
                    const oBindingInfo = oTemplate.getBindingInfo("text");
                    if (oBindingInfo && oBindingInfo.parts && oBindingInfo.parts.length > 0) {
                        sColumnKey = oBindingInfo.parts[0].path; 
                    }
                }

                // Open the dialog directly to the filter tab
                this._openDialog("filter", sColumnKey);
            }
        },
        /**
         * Finds the tracking icon inside the header and toggles its visibility
         * @param {sap.ui.table.Column} oColumn - Target Column control
         * @param {boolean} bIsActive - True to show filter icon, false to clear
         */
        _updateHeaderFilterIconState: function (oColumn, bIsActive) {
            const oLabelControl = oColumn.getLabel();
            
            // Ensure the label control is our custom HBox wrapper layout setup
            if (oLabelControl && oLabelControl.getMetadata().getName() === "sap.m.HBox") {
                const oFilterIcon = oLabelControl.data("filterIcon");
                if (oFilterIcon) {
                    oFilterIcon.setVisible(bIsActive);
                    
                    // Optional: Change icon colors to highlight active blue status
                    if (bIsActive) {
                        oFilterIcon.setColor("#0a6ed1"); // ALV Active Selection Blue Accent
                    } else {
                        oFilterIcon.setColor("#1d2d3d"); // Clear back to standard text gray
                    }
                }
            }
        },
        
        dragStart: () => {
            this._uiStateModel.setProperty("/isDragging", true);
        },

        dragEnd: () => {
            this._uiStateModel.setProperty("/isDragging", false);
        },
        _isDirty: function () {
            const current = JSON.stringify(this._stateModel.getData());
            return current !== this._originalState;
        },
        _updateDirtyFlag: function () {
            const selected = this._variantModel.getProperty("/selected");
            if (!selected) return;
            const isDirty = this._isDirty();
            const variants = this._variantModel.getProperty("/variants");
            const updated = variants.map(v => {
                if (v.key === selected) {
                    return {
                        key: v.key,
                        text: isDirty ? v.key + " *" : v.key
                    };
                }
                return { key: v.key, text: v.key };
            });

            this._variantModel.setProperty("/variants", updated);
        },
        _loadVariantsToModel: function () {
            let all = JSON.parse(localStorage.getItem("variants") || "{}");

            // ✅ ensure Standard exists
            if (!all["Standard"]) {
                all["Standard"] = {
                    columns: [],
                    sort: [],
                    filter: [],
                    group: []
                };
                localStorage.setItem("variants", JSON.stringify(all));
            }

            const names = Object.keys(all);

            // ✅ load default (we’ll improve this below)
            const defaultKey = localStorage.getItem("defaultVariant") || "Standard";

            this._variantModel.setData({
                variants: names.map(n => ({ key: n, text: n })),
                selected: defaultKey
            });
        },
        setColumnMeta: function (mMeta) {
             this._meta = mMeta;
            const cols = Object.keys(mMeta).map((k, i) => ({
                key: k,
                visible: true,
                order: i,
                width: mMeta[k].width || "120px",
                selected: false // ✅ first row selected by default
            }));

            this._stateModel.setProperty("/columns", cols);
            var sVariantName = this._variantModel.getProperty("/selected");
            const all = JSON.parse(localStorage.getItem("variants") || "{}");
            const data = all[sVariantName];
            
            // ✅ PRIORITY 1: pending variant (loaded before meta was ready)
            if (this._pendingVariant && data.columns.length > 0) {
                const v = this._pendingVariant;
                this._pendingVariant = null; // clear first to avoid loops
                this._loadVariant(v);
                return;
            }

            // ✅ PRIORITY 2: default variant
            const defaultKey = this._variantModel.getProperty("/selected");
            if (defaultKey && data.columns.length > 0) {
                this._loadVariant(defaultKey);
                return;
            }

            // ✅ PRIORITY 3: fallback (no variant at all)
             const table = this.getAggregation("_table");
	         const binding = table.getBinding("rows");
            if (! binding) 
            this._applyState();
        },
        _whenRowsBindingReady: function (fnCallback) {
            const table = this.getAggregation("_table");
            const binding = table.getBinding("rows");
            // ✅ already ready
            if (binding) {
                fnCallback();
                return;
            }
            // ✅ wait until rows binding exists
            const check = () => {
                const b = table.getBinding("rows");
                if (b) {
                    clearInterval(timer);
                    fnCallback();
                }
            };
            const timer = setInterval(check, 100);
        },
        setData: function (data) {
            const model = new JSONModel({
                rows: data
            });
            const table = this.getAggregation("_table");
            table.setModel(model);
            table.bindRows("/rows");
            // ✅ apply state after binding exists
            this._whenRowsBindingReady(() => {
                this._applyState();
            });
        },
        _createTable: function () {
            const table = new UITable({
                visibleRowCount: 10,
                toolbar: new Toolbar(
                    {
                        content: [
                          new Button(
                                {
                                    tooltip: "Settings",
                                    icon: "sap-icon://action-settings",
                                    press: () => {
                                        this._openDialog("column");
                                       // this.getModel("viewModel").setProperty("/selectedColumnKey", null);
                                        //this.getModel("viewModel").setProperty("/selectedColumn", null);
                                    }
                                }),
                            new sap.m.ToolbarSeparator(),
                            new Button(
                                {   tooltip: "Sort",
                                    icon: "sap-icon://sort",
                                    enabled: "{= ${viewModel>/selectedColumnKey} ? true : false}",
                                    press: () =>{
                                        if (this._viewModel.getProperty("/selectedColumnKey")) {
                                            this._openDialog("sort");   
                                           // this.getModel("viewModel").setProperty("/selectedColumnKey", null);
                                           // this.getModel("viewModel").setProperty("/selectedColumn", null);
                                        }
                                        }
                                    }
                            ),                          
                                                  
                            new Button(
                                {
                                    tooltip: "Filter",
                                    icon: "sap-icon://filter",
                                    enabled: "{= ${viewModel>/selectedColumnKey} ? true : false}",
                                    press: () =>{
                                         if (this._viewModel.getProperty("/selectedColumnKey")) {
                                          this._openDialog("filter",  this._viewModel.getProperty("/selectedColumnKey"),this._viewModel.getProperty("/selectedColumn"));
                                          //this._viewModel.setProperty("/selectedColumnKey", null);
                                         // this._viewModel.setProperty("/selectedColumn", null);
                                         }
                                        }
                                } ),
                            new Button(
                                {
                                    tooltip: "Group",
                                    icon: "sap-icon://group-2",
                                    enabled: "{= ${viewModel>/selectedColumnKey} ? true : false}",
                                    // this._openDialog("filter", sColumnKey);
                                    press: () => {
                                        if (this._viewModel.getProperty("/selectedColumnKey")) {
                                        this._openDialog("group",  this._viewModel.getProperty("/selectedColumnKey"),this._viewModel.getProperty("/selectedColumn"));
                                        //this._viewModel.setProperty("/selectedColumnKey", null);
                                        //this._viewModel.setProperty("/selectedColumn", null);
                                        }
                                    }
                                }
                            ),
                            //  new Button(
                            //     {text: "Change Layout", 
                            //       //press: () => this._openVariantManager()
                            //        press: () => this._openLoadVariantDialog()
                            //     }
                            // ),
                         //   new sap.m.Text({ text: "Change Layout" }) , 
                          // 🧩 Variant Dropdown
                          new sap.m.Select({
                            width: "200px",
                            selectedKey: "{variant>/selected}",
                            items: {
                              path: "variant>/variants",
                              template: new sap.ui.core.Item({
                                key: "{variant>key}",
                                text: "{variant>text}"
                              })
                            },
                            change: (e) => {
                              const key = e.getParameter("selectedItem").getKey();
                                // ✅ persist default
                                localStorage.setItem("defaultVariant", key);
                                this._loadVariant(key);
                            }
                          }),

                          new sap.m.ToolbarSeparator(),
                         this._grandTotalText

                          // 💾 Save (overwrite)
                          // new sap.m.Button({
                          //   text: "Save",
                          //   icon: "sap-icon://save",
                          //   press: () => {
                          //     const key = this._variantModel.getProperty("/selected");
                          //     if (key) {
                          //       this._saveVariant(key);
                          //     }
                          //   }
                          // }),

                          // // ➕ Save As
                          // new sap.m.Button({
                          //   text: "Save As",
                          //   icon: "sap-icon://save-as",
                          //   press: () => this._openSaveAsDialog()
                          // }),

                          // ⚙️ Manage
                          // new sap.m.Button({
                          //   text: "Manage Layout",
                          //   icon: "sap-icon://action-settings",
                          //   press: () => this._openVariantManager()
                          // })
                          ]
                    }
                )
            });
            this.setAggregation("_table", table);
            this._grandTotalText = new sap.m.Text({
                text: "Grand Total Salary: 0"
            });
            table.attachEvent("rowsUpdated", this.onRowsUpdated, this);
        },
        onRowsUpdated: function (oEvent) {
            // Your logic to execute after rows are rendered/updated
            // You can access the table instance using oEvent.getSource()
           // debugger;
            const oTable = oEvent.getSource();
            const aVisibleRows = oTable.getRows();
            // Get the currently visible rows
            // console.log("Rows updated. Visible rows:", aVisibleRows.length);
            var oData = oTable.getModel();
            if(!oData) return;

           // ==========================================
            // ✅ RETAIN COLUMN HIGHLIGHT DURING SCROLL
            // ==========================================
            const sSavedKey = this._viewModel.getProperty("/selectedColumnKey");
            if (sSavedKey) {
                const aVisibleColumns = oTable.getColumns().filter(col => col.getVisible());
                const iColIndex = aVisibleColumns.findIndex(col => {
                    return col.getSortProperty() === sSavedKey || 
                        col.getFilterProperty() === sSavedKey ||
                        col.getId().split("--").pop() === sSavedKey;
                });

                if (iColIndex !== -1) {
                    // Force rendering logic sync via immediate microtask loop step
                    setTimeout(() => {
                        const oTargetCol = aVisibleColumns[iColIndex];
                        if (oTargetCol) {
                            jQuery("#" + oTargetCol.getId()).addClass("alvHighlightHeader");
                            oTable.$().find("th[data-sap-ui-colid='" + oTargetCol.getId() + "']").addClass("alvHighlightHeader");
                        }
                        oTable.$().addClass("alvSelectedColumn");
                        this._highlightVisibleDomCells(oTable, iColIndex);
                    }, 0);
                }
            }
            // ==========================================

            let _rowAllData = oTable.getBinding('rows');
            var count = aVisibleRows.length;
            if (oData.getData().displayRows.length < count){
                count = oData.getData().displayRows.length;
            }
            var rowStart = oTable.getFirstVisibleRow();
            var currentRowContext;
            if(oData.getData().displayRows.length < 1){
                return;
            }
            for (var i = 0; i < count; i++) {
                var selectedRow = aVisibleRows[i];
                rowStart = rowStart + 1;
                currentRowContext = selectedRow.getBindingContext();
                 let index = currentRowContext.sPath.split("/")[2];
                var _rowData = _rowAllData.getAllCurrentContexts()[index].getObject();
                var columId = "#" + oTable.getId()+ "-rowsel" + i;
                selectedRow.$().removeClass("cusGrpTableRowInfo");
                selectedRow.$().removeClass("cusGrpSubtotalTableRowWarning");
                selectedRow.$().removeClass("cusGrpGrandTotalTableRowSuccess");
                //selectedRow.$().addClass("assemblyPrd");
                switch (_rowData.__rowType) {
                    case "Information":
                        selectedRow.$().addClass("cusGrpTableRowInfo");
                        break;
                    case "Warning":
                         selectedRow.$().addClass("cusGrpSubtotalTableRowWarning");
                        break;
                    case "Success":
                        selectedRow.$().addClass("cusGrpGrandTotalTableRowSuccess");
                        break;    
                    default:
                        // Code to run if no cases match
                    }
            } 
        },
        _openSaveAsDialog: function () {
            const input = new sap.m.Input();
            const dialog = new sap.m.Dialog({
              title: "Save Variant As",
              content: [input],
              beginButton: new sap.m.Button({
                text: "Save",
                press: () => {
                  const name = input.getValue();
                  if (!name) return;
                  this._saveVariant(name);
                  this._loadVariantsToModel();
                  this._variantModel.setProperty("/selected", name);
                  dialog.close();
                }
              }),
              endButton: new sap.m.Button({
                text: "Cancel",
                press: () => dialog.close()
              })
            });

            dialog.open();
          },
        _openVariantManager: function () {
            const all = JSON.parse(localStorage.getItem("variants") || "{}");
            const oModel = new sap.ui.model.json.JSONModel({
              variants: Object.keys(all).map(name => ({
                name
              })),
              selected: null,
              newName: ""
            });
            const list = new sap.m.List({
              mode: "SingleSelectMaster",
              items: {
                path: "/variants",
                template: new sap.m.StandardListItem({
                  title: "{name}",
                  type: "Active"
                })
              },
              selectionChange: (e) => {
                const name = e.getParameter("listItem").getTitle();
                oModel.setProperty("/selected", name);
               // this._variantModel = 
                //this.setModel(this._variantModel, "variant")
              }
            });
            const dialog = new sap.m.Dialog({
              title: "Manage Variants",
              contentWidth: "400px",
              content: [
                list,
                new sap.m.Input({
                  placeholder: "Enter new variant name",
                  value: "{/newName}"
                })

              ],                           
              buttons: [
                // 💾 SAVE AS (overwrite selected)
                new sap.m.Button({
                  text: "Save As",
                  type: "Emphasized",
                  press: () => {
                    const selected = oModel.getProperty("/selected");
                    if (!selected) return;
                    this._saveVariant(selected);
                    this._refreshVariantStore(dialog);
                  }
                }),
                // ➕ SAVE NEW
                new sap.m.Button({
                  text: "Save New",
                  press: () => {
                    const name = oModel.getProperty("/newName");
                    if (!name) return;
                    this._saveVariant(name);
                    this._refreshVariantStore(dialog);
                  }
                }),
                new sap.m.Button({
                text: "Load",
                press: () => {
                  const name = oModel.getProperty("/selected");
                  if (name) {
                    this._loadVariant(name);
                    dialog.close();
                  }
                }
              }), 
                // ❌ DELETE
                new sap.m.Button({
                  text: "Delete",
                  type: "Reject",
                  press: () => {
                    const selected = oModel.getProperty("/selected");
                    if (!selected) return;
                    if (selected === "Standard") {
                        sap.m.MessageToast.show("Standard cannot be deleted");
                        return;
                    }
                    this._deleteVariant(selected);
                    this._refreshVariantStore(dialog);
                  }
                }),
                new sap.m.Button({
                text: "Close",
                press: () => dialog.close()
                }),
              ]
            });

            dialog.setModel(oModel);
            this._variantDialogModel = oModel;
            this._variantDialog = dialog;
            dialog.open();
          },
          _refreshVariantStore: function (dialog) {
            const all = JSON.parse(localStorage.getItem("variants") || "{}");
            const model = this._variantDialogModel;
            model.setProperty("/variants",
                Object.keys(all).map(name => ({ name }))
            );
            model.setProperty("/selected", null);
        },
      _applyState: function () {

        if (!this._meta) return;

        const table = this.getAggregation("_table");
        const state = this._stateModel.getData();
        const model = table.getModel();
        const aSorts = state.sort || [];

        if (!model) return;
        /* this._applyRowHighlight = function (table) {

            table.setRowSettingsTemplate(
                new sap.ui.table.RowSettings({
                    highlight: {
                        path: "__rowType",
                        formatter: function (t) {
                            return t || "None";
                        }
                    }
                })
            );
        }; */
        // =====================================================
        // 1. GET RAW DATA
        // =====================================================
        let rows = model.getProperty("/rows") || [];

        // =====================================================
        // 2. FILTER
        // =====================================================
        const aFilters = [];

        const createFilter = (f) => {

            if (f.values?.length) {
                return new Filter(
                    f.values.map(v =>
                        new Filter(f.key, f.operator || "EQ", v)
                    ),
                    false
                );
            }

            if (f.value1) {
                if (f.operator === "BT") {
                    return new Filter(f.key, "BT", f.value1, f.value2);
                }

                return new Filter(f.key, f.operator || "EQ", f.value1);
            }

            return null;
        };

        state.filter.forEach(f => {
            const filter = createFilter(f);
            if (filter) aFilters.push(filter);
        });

        if (aFilters.length) {
            const binding = table.getBinding("rows");
            if (binding) {
                binding.filter(aFilters);
                rows = binding.getContexts(0, binding.getLength())
                    .map(c => c.getObject());
            }
        }

        // =====================================================
        // 3. SORT
        // =====================================================
        state.sort.forEach(s => {

            const key = s.key;
            const desc = !!s.descending;

            rows.sort((a, b) => {

                if (a[key] === b[key]) return 0;

                return desc
                    ? (a[key] < b[key] ? 1 : -1)
                    : (a[key] > b[key] ? 1 : -1);
            });
        });

        // =====================================================
        // 4. GROUP + ALV TRANSFORMATION
        // =====================================================
        if (state.group.length > 0) {
            rows = this._buildALVData(
                rows,
                state.group[0].key
            );
        }

        // =====================================================
        // 5. SET MODEL + BIND
        // =====================================================
        model.setProperty("/displayRows", rows);
        table.bindRows("/displayRows");
       // this._applyRowHighlight(table);
        table.getBinding("rows").refresh(true);
        table.invalidate();

        const binding = table.getBinding("rows");
        if (!binding) return;

        // =====================================================
        // 6. GROUP DISPLAY COLUMN (ONLY ONE COLUMN SHOW TEXT)
        // =====================================================
        const groupDisplayColumn =
            state.columns.find(c => c.visible)?.key;

        // =====================================================
        // 7. BUILD COLUMNS
        // =====================================================
        table.removeAllColumns();

        state.columns
            .filter(c => c.visible)
            .sort((a, b) => a.order - b.order)
            .forEach(c => {
                // 1. Check if this specific column has an active sort
                 const oSortInfo = aSorts.find(s => s.key === c.key);
                 const meta = this._meta[c.key];

                // 🔍 NEW CHECK: Verify if this column has an active filter row in your state rules
                const aActiveFilters = state.filter || [];
                const bHasActiveFilter = aActiveFilters.some(f => f.key === c.key && (f.value1 !== "" || f.values.length > 0));
                // Create the header HBox container
                const oHeaderLabelControl = this._createALVHeaderLabel(meta.label, c.key);

                //debugger;
                const oNewColumn = new Column({
                    //columnKey: c.key,
                  //  label: meta.label,
                    // ✅ PASS THE HBOX WRAPPER INSTEAD OF A RAW TEXT CONTROL
                    //label: this._createALVHeaderLabel(meta.label, meta.label),
                    label: oHeaderLabelControl, // Pass our custom HBox layout
                    sortProperty: c.key,
                    filterProperty: c.key,
                    width: c.width,
                    // ✅ NEW LOGIC: Set Sort Indicators
                    sorted: !!oSortInfo, 
                    sortOrder: oSortInfo ? (oSortInfo.descending === true ? "Descending" : "Ascending") : "None",
                    showSortMenuEntry: false,
                    showFilterMenuEntry: false,

                    template: new Text({

                        text: {

                            parts: [
                                c.key,
                                "__rowType",
                                "groupText"
                            ],

                            formatter: function (value, rowType, groupText) {

                                const ctx = this.getBindingContext();
                                const row = ctx ? ctx.getObject() : {};

                                // =========================
                                // GROUP ROW
                                // =========================
                                if (row.__rowType === "Information") {

                                    if (c.key === groupDisplayColumn) {
                                        return row.groupText || "";
                                    }

                                    return "";
                                }

                                // =========================
                                // SUBTOTAL ROW
                                // =========================
                                if (row.__rowType === "Warning") {

                                    if (c.key === "Name") {
                                        return "Subtotal";
                                    }

                                    return value;
                                }

                                // =========================
                                // GRAND TOTAL ROW
                                // =========================
                                if (row.__rowType === "Success") {

                                    if (c.key === "Name") {
                                        return "Grand Total";
                                    }

                                    return value;
                                }

                                // =========================
                                // NORMAL ROW
                                // =========================
                                return value;
                            }
                        }
                    })
                   
                 });

                table.addColumn(oNewColumn);
                // ✅ FIX: Re-apply header CSS highlight state if this column was the selected one
                if (c.key ===  this._viewModel.getProperty("/selectedColumnKey")) {
                   // oNewColumn.addStyleClass("alvHighlightHeader");
                    // Ensure the parent container is flagged
                    table.addStyleClass("alvSelectedColumn");
                }
                // ✅ Apply the active visual flag right now to the freshly instantiated control object reference
                    if (bHasActiveFilter) {
                        this._updateHeaderFilterIconState(table.getColumns()[table.getColumns().length - 1], true);
                    }
             });

        // =====================================================
        // 8. ROW HIGHLIGHT (FULL ROW ALV STYLE)
        // =====================================================
     /*   table.setRowSettingsTemplate(
            new sap.ui.table.RowSettings({
                highlight: {
                    path: "__rowType",
                    formatter: function (type) {

                        switch (type) {

                            case "Information":
                                return "Information";

                            case "Warning":
                                return "Warning";

                            case "Success":
                                return "Success";

                            default:
                                return "None";
                        }
                    }
                }
            })
        ); */

        // =====================================================
        // 9. GRAND TOTAL DISPLAY
        // =====================================================
        const grandTotal = this._calculateGrandTotal();

        if (this._grandTotalText) {
            this._grandTotalText.setText(
                "Grand Total Salary: " +
                grandTotal.toLocaleString()
            );
        }

        this._updateDirtyFlag();
    },
        _buildALVData: function (rows, groupKey) {

            if (!groupKey) {
                return rows;
            }

            const result = [];
            let grandTotal = 0;

            // =========================
            // 1. GROUP DATA
            // =========================
            const groups = {};

            rows.forEach(row => {
                const key = row[groupKey] || "EMPTY";

                if (!groups[key]) {
                    groups[key] = [];
                }

                groups[key].push(row);
            });

            // =========================
            // 2. BUILD GROUPS
            // =========================
            Object.keys(groups).forEach(groupValue => {

                const groupRows = groups[groupValue];

                let subtotal = 0;

                // =========================
                // GROUP HEADER ROW
                // =========================
                result.push({
                    __rowType: "Information",
                    groupText: `${groupKey}: ${groupValue}`,
                    Salary: null
                });

                // =========================
                // DATA ROWS
                // =========================
                groupRows.forEach(r => {

                    const salary = Number(r.Salary || 0);

                    subtotal += salary;
                    grandTotal += salary;

                    result.push({
                        ...r,
                        __rowType: "None"
                    });
                });

                // =========================
                // SUBTOTAL ROW
                // =========================
                result.push({
                    __rowType: "Warning",
                    Name: "Subtotal",
                    Salary: subtotal
                });
            });

            // =========================
            // GRAND TOTAL ROW
            // =========================
            result.push({
                __rowType: "Success",
                Name: "Grand Total",
                Salary: grandTotal
            });

            return result;
        },
     _calculateSubtotal: function (groupKey, groupValue) {

            const table = this.getAggregation("_table");

            const model = table.getModel();

            if (!model) {
                return {
                    count: 0,
                    salary: 0
                };
            }

            const rows = model.getProperty("/rows") || [];

            // ✅ filter same group
            const groupedRows = rows.filter(row =>
                row[groupKey] === groupValue
            );

            // ✅ calculate salary subtotal
            const salary = groupedRows.reduce((sum, row) => {
                return sum + (Number(row.Salary) || 0);
            }, 0);

            return {
                count: groupedRows.length,
                salary: salary
            };
        },
        _calculateGrandTotal: function () {
            const table = this.getAggregation("_table");
            const data =
                table.getModel().getProperty("/rows") || [];
            return data.reduce((sum, row) => {
                return sum + (Number(row.Salary) || 0);
            }, 0);
        },
     
        _openDialog: function (sTabKey, sTargetColumnKey,oColumn) {
            var that = this;
            if (!this._dialog) {
                // ✅ Store tabBar on 'this' so it can be reached later
                this._oTabBar = new IconTabBar({
                    items: [
                        this._columnsTab().setKey("columnTab"), // Ensure keys match
                        this._sortTab().setKey("sortTab"),
                        this._filterTab().setKey("filterTab"),
                        this._groupTab().setKey("groupTab")
                    ]
                });

                this._dialog = new Dialog({
                    title: "Grid Settings",
                    contentWidth: "700px",
                    contentHeight: "500px",
                    draggable: true, // ✅ ENABLE MOUSE DRAGGING CAPABILITY
                    resizable: true, // 💡 OPTIONAL: Allows the user to resize the window
                    content: [this._oTabBar], // Use the stored tabBar
                    buttons: [
                        new Button({
                            text: "Apply",
                            press: () => {
                                this._applyState();
                                // ✅ TOGGLE THE FILTER ICON VISIBLE ON THE CLICKED COLUMN
                               /*  let oColumn = that._viewModel.getProperty("/selectedColumn");
                                if (oColumn) {
                                this._updateHeaderFilterIconState(oColumn, true);
                                } */
                                that._viewModel.setProperty("/selectedColumnKey", null);
                                that._viewModel.setProperty("/selectedColumn", null);
                                this._dialog.close();
                            }
                        }),
                        new Button({
                            text: "Save As",
                            icon: "sap-icon://save-as",
                            press: () => {
                                const selected = this._variantModel.getProperty("/selected");
                                if (!selected) return;
                                this._saveVariant(selected);
                                this._refreshVariantStore(this._dialog);
                            }
                        }),
                        new Button({
                            text: "Save New",
                            press: () => this._openSaveDialog()
                        }),
                        new Button({
                            text: "Manage Layout",
                            press: () => this._openVariantManager()
                        }),
                        new Button({
                            text: "Close",
                            press: () =>{
                                  this._viewModel.setProperty("/selectedColumnKey", null);
                                  this._viewModel.setProperty("/selectedColumn", null);
                                  this._dialog.close()
                            } 
                        })
                    ]
                });

                this._dialog.setModel(this._stateModel, "state");
            }
             var sColumnKey = "Department"; // Default column key
            // ✅ Selection Logic: Must be outside the 'if (!this._dialog)' block
            if (sTabKey === "filter") {
                this._oTabBar.setSelectedKey("filterTab");
                sColumnKey = sTargetColumnKey;
                const aFilters = this._stateModel.getProperty("/filter") || [];
                // 1. Check if a filter parameter with this exact column key already exists
                const bFilterExists = aFilters.some(function (oFilterRow) {
                    return oFilterRow.key === sColumnKey;
                });

                // 2. Only push a new filter row if it does not exist yet
                if (!bFilterExists) {
                    aFilters.push({
                        key: sColumnKey,
                        operator: "Equals",
                        value1: "",
                        value2: "",
                        values: [],
                        exclude: false
                    });
                    
                    // Update the state model with the modified array
                    this._stateModel.setProperty("/filter", aFilters);
                    this._stateModel.refresh(true);
                
                // console.log("Added new filter parameter definition for column: " + sColumnKey);
                }
            }else if (sTabKey === "sort") {
                this._oTabBar.setSelectedKey("sortTab");
                 sColumnKey = sTargetColumnKey;

                const aSorts = this._stateModel.getProperty("/sort") || [];
                // 1. Check if a filter parameter with this exact column key already exists
                const bSortExists = aSorts.some(function (oSortRow) {
                    return oSortRow.key === sColumnKey;
                });
                // 2. Only push a new filter row if it does not exist yet
                if (!bSortExists) {
                    aSorts.push({
                        key: sColumnKey,
                        descending: false // Default to ascending sort when adding a new sort parameter
                    });
                    
                    // Update the state model with the modified array
                    this._stateModel.setProperty("/sort", aSorts);
                    this._stateModel.refresh(true);
                
                }
            }
            else if (sTabKey === "group") {
                this._oTabBar.setSelectedKey("groupTab");
                 sColumnKey = sTargetColumnKey;
                 const agroups = this._stateModel.getProperty("/group") || [];
                // 1. Check if a filter parameter with this exact column key already exists
                const bgroupExists = agroups.some(function (oGroupRow) {
                    return oGroupRow.key === sColumnKey;
                });
                // 2. Only push a new filter row if it does not exist yet
                if (!bgroupExists) {
                    agroups.push({
                        key: sColumnKey
                    });
                    
                    // Update the state model with the modified array
                    this._stateModel.setProperty("/group", agroups);
                    this._stateModel.refresh(true);
                
                }
                else{
                    agroups.pop();
                     agroups.push({
                        key: sColumnKey
                    });                   
                    this._stateModel.setProperty("/group", agroups);
                    this._stateModel.refresh(true);
                }
            }    
             else {
                this._oTabBar.setSelectedKey("columnTab");
                 sColumnKey = sTargetColumnKey;
            }         
            this._dialog.open();    
            // 2. ✅ FIX: Wait for the rendering tree to finish mounting the DOM nodes, then enforce focus
            setTimeout(() => {
                // Find the specific IconTabFilter control instance inside the TabBar
                const oTargetTabFilter = this._oTabBar.getItems().find(item => item.getKey() === sTabKey);
                
                if (oTargetTabFilter) {
                    // This forces browser focus onto the clickable header tab element
                    oTargetTabFilter.focus();
                }
            }, 0);                  
        },

        _onFilterSearch: function () {
            // Use this.getAggregation("_table") to find the list within the control scope
            const oList = sap.ui.getCore().byId(this.getId() + "--filterColumnList");
            
            if (!oList) return;

            const sQuery = this._stateModel.getProperty("/filterSearchValue");
            const oBinding = oList.getBinding("items");

            if (oBinding) {
                if (sQuery) {
                    // Filter by the technical key or the label
                    const oFilter = new Filter({
                        filters: [
                            new Filter("key", sap.ui.model.FilterOperator.Contains, sQuery),
                            new Filter("label", sap.ui.model.FilterOperator.Contains, sQuery)
                        ],
                        and: false
                    });
                    oBinding.filter([oFilter]);
                } else {
                    oBinding.filter([]);
                }
            }
        },
        _openSaveDialog: function () {
              const input = new sap.m.Input();
              new sap.m.Dialog({
                title: "Save Layout",
                content: [input],
                beginButton: new sap.m.Button({
                  text: "Save",
                  press: () => {
                    const name = input.getValue();
                    if (name) {
                      this._saveVariant(name);
                    }
                  }
                }),
                endButton: new sap.m.Button({
                  text: "Cancel",
                  press: function () {
                    this.getParent().close();
                  }
                })
              }).open();
            },
            _openLoadVariantDialog: function () {

                const all = JSON.parse(localStorage.getItem("variants") || "{}");

                const model = new sap.ui.model.json.JSONModel({
                items: Object.keys(all).map(name => ({ name }))
                });

            const list = new sap.m.List({
                mode: "SingleSelectMaster",

                items: {
                path: "/items",
                template: new sap.m.StandardListItem({
                    title: "{name}"
                })
                },

                selectionChange: (e) => {
                const item = e.getParameter("listItem");
                const name = item.getTitle();

                this._loadVariant(name);
                this._dlg.close();
                }
            });

            this._dlg = new sap.m.Dialog({
              title: "Select Layout",
              contentWidth: "300px",
              content: [list],
              endButton: new sap.m.Button({
                text: "Close",
                press: () => this._dlg.close()
              })
            });

            this._dlg.setModel(model);
            this._dlg.open();
          },
        _saveVariant: async function (sVariantName) {
            const all = JSON.parse(localStorage.getItem("variants") || "{}");
            const data = JSON.parse(JSON.stringify(this._stateModel.getData()));
            all[sVariantName] = data;
            localStorage.setItem("variants", JSON.stringify(all));
            // ✅ reset dirty baseline AFTER save
             this._originalState = JSON.stringify(data);
             sap.m.MessageToast.show("Saved: " + sVariantName);
             await this._loadVariantsToModel();
        },
        _deleteVariant: function (name) {
          const all = JSON.parse(localStorage.getItem("variants") || "{}");
          delete all[name];
          localStorage.setItem("variants", JSON.stringify(all));
          sap.m.MessageToast.show("Deleted: " + name);
        },
        _loadVariant: function (sVariantName) {
            const all = JSON.parse(localStorage.getItem("variants") || "{}");
            const data = all[sVariantName];
            if (!data) return;
            this._stateModel.setData(JSON.parse(JSON.stringify(data)));
             // ✅ FIX: restore selection
            const cols = this._stateModel.getProperty("/columns") || [];
            cols.forEach(c => {
                if (c.selected === undefined) {
                    c.selected = false;
                }
            });           
            this._variantModel.setProperty("/selected", sVariantName);
            // ✅ set baseline for dirty check
            //this._originalState = JSON.stringify(data);
            // ✅ update UI selection
            this._variantModel.setProperty("/selected", sVariantName);
            if(!this._stateModel){
                if (sVariantName === "Standard" && this._meta) {
                    const cols = Object.keys(this._meta).map((k, i) => ({
                        key: k,
                        visible: true,
                        order: i,
                        width: this._meta[k].width || "120px",
                        selected: false
                    }));

                    this._stateModel.setProperty("/columns", cols);
                }
            }
                // ✅ wait for rows binding
                this._whenRowsBindingReady(() => {

                    this._applyState();

                    this._originalState = JSON.stringify(
                        this._stateModel.getData()
                    );

/*                     sap.m.MessageToast.show(
                        "Loaded: " + sVariantName
                    ); */
                });
            if (this._meta) {
                this._applyState();
            } else {
                this._pendingVariant = sVariantName;
            }
            this._stateModel.refresh(true);

        },
        _columnsTab: function () {
            return new IconTabFilter({
                key: "columnTab",
                text: "Columns",
                content: [new List(
                        {
                            mode: "SingleSelectMaster",
                            includeItemInSelection: true, 
                            items: {
                                path: "state>/columns",
                                sorter: new sap.ui.model.Sorter("order", false),
                                template: new CustomListItem(
                                    {
                                        highlight: {
                                            path: "state>selected",
                                            formatter: (bSelected) => bSelected ? "Information" : "None"
                                        },
                                        content: new HBox({
                                                    alignItems: "Center",
                                                    justifyContent: "SpaceBetween",
                                                    items: [
                                                        // LEFT SIDE (existing controls)
                                                        new HBox({
                                                            items: [
                                                                //new CheckBox({ selected: "{state>visible}" }),
                                                                new CheckBox({
                                                                        selected: "{state>selected}",
                                                                        select: (oEvent) => {
                                                                            const ctx = oEvent.getSource().getBindingContext("state");
                                                                            const obj = ctx.getObject();
                                                                            //debugger;
                                                                            obj.selected = oEvent.getParameter("selected");
                                                                            obj.visible =  obj.selected;
                                                                            this._stateModel.refresh(true);
                                                                                                                                            }
                                                                    }),
                                                                 new Text({ text: "{state>key}" }),
                                                                new Input({ value: "{state>width}", width: "80px" })
                                                            ]
                                                        }),
                                                        // RIGHT SIDE (move buttons)
                                                        new HBox({
                                                           // visible: "{= ${state>selected} === true }", // ✅ FIX
                                                            visible: "{= ${state>selected} === true }",
                                                            items: [
                                                                new sap.m.Button({
                                                                    icon: "sap-icon://collapse-group",
                                                                    tooltip: "Move First",
                                                                    enabled: "{= !${ui>/isDragging} }",
                                                                    press: (e) => this._moveColumn(this._getIndex(e), "first")
                                                                }),
                                                                new sap.m.Button({
                                                                    icon: "sap-icon://slim-arrow-up",
                                                                    tooltip: "Move Up",
                                                                    enabled: "{= !${ui>/isDragging} }",
                                                                    press: (e) => this._moveColumn(this._getIndex(e), "up")
                                                                }),
                                                                new sap.m.Button({
                                                                    icon: "sap-icon://slim-arrow-down",
                                                                    tooltip: "Move Down",
                                                                    enabled: "{= !${ui>/isDragging} }",
                                                                    press: (e) => this._moveColumn(this._getIndex(e), "down")
                                                                }),
                                                                new sap.m.Button({
                                                                    icon: "sap-icon://expand-group",
                                                                    tooltip: "Move Last",
                                                                    enabled: "{= !${ui>/isDragging} }",
                                                                    press: (e) => this._moveColumn(this._getIndex(e), "last")
                                                                })
                                                            ]
                                                        }).addStyleClass("moveButtons")
                                                    ]
                                                })
                                    }
                                ).addStyleClass("columnRow") 
                            },
                            dragDropConfig: [
                                            new sap.ui.core.dnd.DragInfo({
                                                sourceAggregation: "items"
                                            }),
                                            new sap.ui.core.dnd.DropInfo({
                                                targetAggregation: "items",
                                                dropPosition: "Between",
                                                drop: (oEvent) => {
                                                    const dragged = oEvent.getParameter("draggedControl");
                                                    const dropped = oEvent.getParameter("droppedControl");
                                                    const from = this._getIndexFromItem(dragged);
                                                    const to = this._getIndexFromItem(dropped);
                                                    this._reorderByDrag(from, to);
                                                }
                                            })
                                        ]
                        }
                    ).addStyleClass("columnRow")]
            });
        },
        _getIndex: function (oEvent) {
            const ctx = oEvent.getSource().getBindingContext("state");
            const path = ctx.getPath(); // "/columns/3"
            return parseInt(path.split("/").pop(), 10);
        },
        _getIndexFromItem: function (item) {
            const ctx = item.getBindingContext("state");
            return parseInt(ctx.getPath().split("/").pop(), 10);
        },

        _reorderByDrag: function (from, to) {
            const cols = this._stateModel.getProperty("/columns");
            const [moved] = cols.splice(from, 1);
            cols.splice(to, 0, moved);
            cols.forEach((c, i) => c.order = i);
            this._stateModel.refresh(true);
        },
       _sortTab: function () {
                return new IconTabFilter({
                    key: "sortTab",
                    text: "Sort",
                     content: [
                         new sap.m.OverflowToolbar({
                            content: [
                                new sap.m.ToolbarSpacer(),
                                new Button({
                                    text: "Add Sort",
                                    icon: "sap-icon://add",
                                    type: "Emphasized",
                                    press: () => {
                                        const d = this._stateModel.getProperty("/sort");
                                        const firstKey = Object.keys(this._meta)[0];
                                        d.push({ key: firstKey, descending: false });
                                        this._stateModel.refresh(true);
                                    }
                                })                           
                            ]
                         }),
                        new List({
                                    items: {
                                        path: "state>/sort",
                                        template: new CustomListItem({
                                            content: new HBox({
                                                alignItems: "Center",
                                                justifyContent: "Start",
                                                items: [
                                                    // ✅ PLACE IT HERE (first element)
                                                    new sap.m.Text({
                                                        text: "Sort by"
                                                    }).addStyleClass("sapUiTinyMarginEnd"),
                                                // 🔽 Column selector
                                                    new Select({
                                                        selectedKey: "{state>key}",
                                                        width: "180px",
                                                        items: this._getItems()
                                                    }),
                                                    // 🔽 SegmentedButton (FIXED)
                                                    new sap.m.SegmentedButton({
                                                        width: "120px",

                                                        selectedKey: {
                                                            path: "state>descending",
                                                            formatter: function (b) {
                                                                return b ? "true" : "false";
                                                            }
                                                        },
                                                        items: [
                                                            new sap.m.SegmentedButtonItem({
                                                                key: "false",
                                                                icon: "sap-icon://sort-ascending",
                                                                tooltip: "Ascending"
                                                            }),
                                                            new sap.m.SegmentedButtonItem({
                                                                key: "true",
                                                                icon: "sap-icon://sort-descending",
                                                                tooltip: "Descending"
                                                            })
                                                        ],
                                                        selectionChange: function (oEvent) {
                                                            const key = oEvent.getParameter("item").getKey();
                                                            const ctx = oEvent.getSource().getBindingContext("state");
                                                            ctx.getObject().descending = (key === "true");
                                                            this._stateModel.refresh(true);
                                                        }.bind(this)
                                                    }).addStyleClass("sapUiTinyMarginBegin"),
                                                    new sap.m.Text({
                                                            text: {
                                                                path: "state>descending",
                                                                formatter: function (b) {
                                                                    return b ? "Descending" : "Ascending";
                                                                }
                                                            }
                                                        }).addStyleClass("sapUiTinyMarginBegin"),
                                                        // 🗑 DELETE BUTTON (NEW)
                                                        new sap.m.Button({
                                                            icon: "sap-icon://delete",
                                                            type: "Transparent",
                                                            tooltip: "Remove Sort",
                                                            press: (oEvent) => {
                                                                const ctx = oEvent.getSource().getBindingContext("state");
                                                                const path = ctx.getPath(); // e.g. /sort/0
                                                                const index = parseInt(path.split("/").pop());
                                                                const sortData = this._stateModel.getProperty("/sort");
                                                                sortData.splice(index, 1);
                                                                this._stateModel.refresh(true);
                                                            }
                                                        }).addStyleClass("sapUiTinyMarginBegin")
                                                ]
                                            })

                                        })
                                    }
                                })
                     ]         
                });
            },      
       _filterTab: function () {
            return new IconTabFilter({
                key: "filterTab",
                text: "Filters",
                //icon: "sap-icon://filter",
                content: [
                    // 1. Toolbar with Search and Add functionality
                    new sap.m.OverflowToolbar({
                        content: [
                                             
                            new sap.m.ToolbarSpacer(),
                            new Button({
                                text: "Add Filter",
                                icon: "sap-icon://add",
                                type: "Emphasized",
                                press: () => {
                                    const d = this._stateModel.getProperty("/filter") || [];
                                    // Pick the first available column key as default
                                    const firstKey = Object.keys(this._meta)[0]; 
                                    d.push({
                                        key: firstKey,
                                        operator: "EQ",
                                        value1: "",
                                        value2: "",
                                        values: [],
                                        exclude: false
                                    });
                                    this._stateModel.setProperty("/filter", d);
                                    this._stateModel.refresh(true);
                                }
                            })
                        ]
                    }),

                    // 2. The List of active filters
                    new List({
                        id: this.getId() + "--filterColumnList", // Required for _onFilterSearch
                        noDataText: "No filters defined. Click 'Add Filter' or select a column header.",
                        items: {
                            path: "state>/filter",
                            template: new CustomListItem({
                                content: new HBox({
                                    alignItems: "Center",
                                    justifyContent: "Start",
                                    items: [
                                        // Operator Selection
                                        new Select({
                                            selectedKey: "{state>operator}",
                                            width: "120px",
                                            items: [
                                                new Item({key: "EQ", text: "Equals"}),
                                                new Item({key: "Contains", text: "Contains"}),
                                                new Item({key: "BT", text: "Between"}),
                                                new Item({key: "GT", text: "Greater Than"}),
                                                new Item({key: "LT", text: "Less Than"})
                                            ]
                                        }).addStyleClass("sapUiTinyMarginEnd"),

                                        // Field/Column Selection
                                        new Select({
                                            selectedKey: "{state>key}",
                                            width: "180px",
                                            items: this._getItems(), // Populates from your metadata
                                            change: () => this._stateModel.refresh(true)
                                        }).addStyleClass("sapUiTinyMarginEnd"),

                                        // Exclude Checkbox
                                        new sap.m.CheckBox({
                                            text: "Exclude",
                                            selected: "{state>exclude}",
                                            visible: false // Hide if not needed, or implement logic to show for certain operators
                                        }).addStyleClass("sapUiTinyMarginEnd"),

                                        // Value Control (Input/MultiInput/Date)
                                        this._createValueControl(),

                                        new sap.m.ToolbarSpacer(),

                                        // Delete Button
                                        new sap.m.Button({
                                            icon: "sap-icon://delete",
                                            type: "Transparent",
                                            tooltip: "Remove this filter",
                                            press: (e) => {
                                                const ctx = e.getSource().getBindingContext("state");
                                                const path = ctx.getPath();
                                                const index = parseInt(path.split("/").pop());

                                                const filters = this._stateModel.getProperty("/filter");
                                                filters.splice(index, 1);
                                                this._stateModel.refresh(true);
                                                
                                                // Refresh search to keep list consistent
                                              //  this._onFilterSearch();
                                            }
                                        })
                                    ]
                                }).addStyleClass("sapUiSmallMargin")
                            })
                        }
                    })
                ]
            });
        },
       _groupTab: function () {
            return new IconTabFilter({
                key: "groupTab",
                text: "Group",
                content: [
                    new sap.m.OverflowToolbar({
                      content: [
                        new sap.m.ToolbarSpacer(),
                        new Button({
                            text: "Add Group",
                            icon: "sap-icon://add",
                            type: "Emphasized",
                            press: () => {
                                const d = this._stateModel.getProperty("/group");
                                const firstKey = Object.keys(this._meta)[0];

                                d.push({ key: firstKey });

                                this._stateModel.refresh(true);
                            }
                        }),
                    ] })  ,
                    new List({
                        items: {
                            path: "state>/group",
                            template: new CustomListItem({

                                content: new HBox({
                                    alignItems: "Center",
                                    justifyContent: "Start",
                                    items: [

                                        // 🔽 Group field selector
                                        new Select({
                                            selectedKey: "{state>key}",
                                            width: "200px",
                                            items: this._getItems()
                                        }),

                                        // 🗑 DELETE BUTTON
                                        new sap.m.Button({
                                            icon: "sap-icon://delete",
                                            type: "Transparent",
                                            tooltip: "Remove Group",

                                            press: (oEvent) => {
                                                const ctx = oEvent.getSource().getBindingContext("state");
                                                const index = parseInt(ctx.getPath().split("/").pop());

                                                const groupData = this._stateModel.getProperty("/group");
                                                groupData.splice(index, 1);

                                                this._stateModel.refresh(true);
                                            }
                                        }).addStyleClass("sapUiTinyMarginBegin")

                                    ]
                                })

                            })
                        }
                    }) 
                ]
                           
            });
        },

        _getItems: function () {
            if (!this._meta) {
                return [];
            }
            return Object.keys(this._meta).map(k => new Item({key: k, text: this._meta[k].label}));
        },

        _getUniqueValues: function (sKey) {
          const oTable = this.getAggregation("_table");
          const data = oTable.getModel().getProperty("/rows") || [];

          const map = {};

          data.forEach(row => {
            const val = row[sKey];
            if (val !== undefined && val !== null) {
              map[val] = (map[val] || 0) + 1;
            }
          });

          return Object.keys(map).map(k => ({
            value: k
           // count: map[k]
          }));
        },
        _createValueControl_1: function () {
            return new sap.m.ComboBox({
                width: "200px",
                showSecondaryValues: false,
                selectionChange: (e) => {
                    const ctx = e.getSource().getBindingContext("state");
                    ctx.getObject().value1 = e.getParameter("selectedItem").getKey();
                }
            });
        },
        _createValueControl_2: function () {
            return new sap.m.HBox({
                items: [
                    new sap.m.Input(
                        {value: "{state>value1}", width: "200px"}
                    ),
                    new sap.m.Button(
                        {
                            icon: "sap-icon://value-help",
                            press: (e) => {
                                const ctx = e.getSource().getBindingContext("state");
                                const key = ctx.getObject().key;
                                this._openValueHelp(key, ctx);
                            }
                        }
                    )
                ]
            });
        },
        _createValueControl: function () {
            return new sap.m.MultiInput({
                width: "250px",

                tokens: {
                    path: "state>values",
                    template: new sap.m.Token(
                        {text: "{state>}", key: "{state>}"}
                    )
                },

                tokenUpdate: (e) => {
                    const ctx = e.getSource().getBindingContext("state");
                    const data = ctx.getObject();

                    data.values = e.getSource().getTokens().map(t => t.getKey());
                    this._stateModel.refresh(true);
                },

                showValueHelp: true,
                valueHelpRequest: (e) => {
                    const ctx = e.getSource().getBindingContext("state");
                    const key = ctx.getObject().key;

                    this._openValueHelpMulti(key, ctx, e.getSource());
                }
            });
        },
        _openValueHelpMulti: function (sKey, oContext, oInput) {
            const values = this._getUniqueValues(sKey);

            this._vhContext = oContext;
            this._vhInput = oInput;

             const oModel = new sap.ui.model.json.JSONModel({
               // items: values.map(v => ({value: v}))
                items: values.map(v => ({
                value: v.value,
                text: `${v.value}`
              }))
            }); 

            if (!this._vhDialog) {
                this._vhDialog = new sap.m.Dialog({
                    title: "Select Values",
                    contentWidth: "300px",
                    contentHeight: "400px",

                    content: [
                        new sap.m.SearchField(
                            {
                                liveChange: (e) => {
                                    const val = e.getParameter("newValue");
                                    const list = e.getSource().getParent().getContent()[1];
                                    list.getBinding("items").filter(new sap.ui.model.Filter("value", sap.ui.model.FilterOperator.Contains, val));
                                }
                            }
                        ),
                        new sap.m.List(
                            {
                                mode: "MultiSelect",
                                items: {
                                    path: "/items",
                                    template: new sap.m.StandardListItem(
                                       // {title: "{value}"}
                                        {title: "{text}"}
                                    )
                                }
                            }
                        )
                    ],

                    beginButton: new sap.m.Button(
                        {
                            text: "OK",
                            press: () => {
                                const list = this._vhDialog.getContent()[1];
                                const selected = list.getSelectedItems().map(i => i.getTitle());
                                const obj = this._vhContext.getObject();
                                obj.values = selected;
                                this._stateModel.refresh(true);
                                this._vhDialog.close();
                            }
                        }
                    ),

                    endButton: new sap.m.Button(
                        {
                            text: "Cancel",
                            press: () => this._vhDialog.close()
                        }
                    )
                });
            }

            this._vhDialog.setModel(oModel);
            this._vhDialog.open();
        },
        
        _openValueHelp: function (sKey, oContext) {
            const values = this._getUniqueValues(sKey);
            // ✅ store current context (THIS is the fix)
            this._vhContext = oContext;
            const oModel = new sap.ui.model.json.JSONModel({
                items: values.map(v => ({value: v}))
            });
            if (!this._vhDialog) {
                this._vhDialog = new sap.m.Dialog({
                    title: "Select Value",
                    contentWidth: "300px",
                    contentHeight: "400px",
                    content: [
                        new sap.m.SearchField(
                            {
                                liveChange: (e) => {
                                    const val = e.getParameter("newValue");
                                    const list = e.getSource().getParent().getContent()[1];
                                    const binding = list.getBinding("items");

                                    binding.filter(new sap.ui.model.Filter("value", sap.ui.model.FilterOperator.Contains, val));
                                }
                            }
                        ),
                        new sap.m.List(
                            {
                                mode: "SingleSelectMaster",
                                items: {
                                    path: "/items",
                                    template: new sap.m.StandardListItem(
                                        {title: "{value}"}
                                    )
                                },

                                // ✅ IMPORTANT: use stored context, not closure
                                selectionChange: (e) => {
                                    const selected = e.getParameter("listItem").getTitle();

                                    if (this._vhContext) {
                                        this._vhContext.getObject().value1 = selected;
                                        this._stateModel.refresh(true);
                                    }
                                    this._vhDialog.close();
                                }
                            }
                        )
                    ],
                    endButton: new sap.m.Button(
                        {
                            text: "Close",
                            press: () => this._vhDialog.close()
                        }
                    )
                });
            }
            this._vhDialog.setModel(oModel);
            this._vhDialog.open();
        },
        _moveColumn: function (index, direction) {
            const cols = this._stateModel.getProperty("/columns");
            if (index < 0 || index >= cols.length) return;
            let newIndex = index;
            switch (direction) {
                case "up":
                    newIndex = index - 1;
                    break;
                case "down":
                    newIndex = index + 1;
                    break;
                case "first":
                    newIndex = 0;
                    break;
                case "last":
                    newIndex = cols.length - 1;
                    break;
            }
            if (newIndex < 0 || newIndex >= cols.length) return;
            // ✅ remove and insert
            const [moved] = cols.splice(index, 1);
            cols.splice(newIndex, 0, moved);
            // ✅ reassign order
            cols.forEach((c, i) => c.order = i);
            this._stateModel.refresh(true);
        },
        renderer: function (oRM, oControl) {
            oRM.openStart("div");
            oRM.openEnd();
            oRM.renderControl(oControl.getAggregation("_table"));
            oRM.close("div");
        }
    });
});
