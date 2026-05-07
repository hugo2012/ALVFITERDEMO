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
], function (Control, UITable, Column, Text, Button, Toolbar, Dialog, IconTabBar, IconTabFilter, List, CustomListItem, HBox, VBox, CheckBox, Input, Select, Switch, Item, JSONModel, Sorter, Filter) {
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
            // ✅ APPLY DEFAULT VARIANT
            const defaultKey = this._variantModel.getProperty("/selected");
            if (defaultKey) {
                this._loadVariant(defaultKey);
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

            // ✅ PRIORITY 1: pending variant (loaded before meta was ready)
            if (this._pendingVariant) {
                const v = this._pendingVariant;
                this._pendingVariant = null; // clear first to avoid loops
                this._loadVariant(v);
                return;
            }

            // ✅ PRIORITY 2: default variant
            const defaultKey = this._variantModel.getProperty("/selected");
            if (defaultKey) {
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
                                {text: "Settings", press: this._openDialog.bind(this)}
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
            debugger;
            const oTable = oEvent.getSource();
            const aVisibleRows = oTable.getRows();
            // Get the currently visible rows
            // console.log("Rows updated. Visible rows:", aVisibleRows.length);
            var oData = oTable.getModel();
            if(!oData) return;
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
        // _applyState: function () {
        //     if (!this._meta) {
        //         return; // ⛔ meta not ready yet
        //     }             
        //     const table = this.getAggregation("_table");
        //     const state = this._stateModel.getData();
        //     table.removeAllColumns();
        //     state.columns.filter(c => c.visible).sort((a, b) => a.order - b.order).forEach(c => {
        //         const meta = this._meta[c.key];
        //         table.addColumn(new Column({
        //             label: meta.label,
        //             sortProperty: c.key,
        //             filterProperty: c.key,
        //             width: c.width,
        //             // ✅ disable default menu (sort/filter popup)
        //             showSortMenuEntry: false,
        //             showFilterMenuEntry: false,
        //             template: new Text({

        //             text: {

        //                 parts: [
        //                     { path: c.key },
        //                     { path: "__group" },
        //                     { path: "__subtotal" },
        //                     { path: "__grandtotal" },
        //                     { path: "groupText" }
        //                 ],

        //                 formatter: function (
        //                     value,
        //                     isGroup,
        //                     isSubtotal,
        //                     isGrand,
        //                     groupText
        //                 ) {

        //                     // GROUP HEADER
        //                     if (isGroup) {

        //                         if (c.key === "Name") {
        //                             return groupText;
        //                         }

        //                         return "";
        //                     }

        //                     // SUBTOTAL
        //                     if (isSubtotal) {

        //                         if (c.key === "Name") {
        //                             return "Subtotal";
        //                         }

        //                         return value;
        //                     }

        //                     // GRAND TOTAL
        //                     if (isGrand) {

        //                         if (c.key === "Name") {
        //                             return "Grand Total";
        //                         }

        //                         return value;
        //                     }

        //                     return value;
        //                 }
        //             }
        //         })
        //             // template: new Text(
        //             //     {text: `{${
        //             //             c.key
        //             //         }}`}
        //             // )
        //         }));
        //     });
        //     const model = table.getModel();

        //     let rows =
        //         model.getProperty("/rows") || [];

        //     // ✅ apply grouping transformation
        //     if (state.group.length > 0) {

        //         rows = this._buildALVData(
        //             rows,
        //             state.group[0].key
        //         );
        //     }

        //     // ✅ replace displayed rows
        //     model.setProperty("/displayRows", rows);

        //     // ✅ rebind
        //     table.bindRows("/displayRows");
        //     const binding = table.getBinding("rows");
        //     if (! binding) 
        //         return;           
        //     const sorters = [];
        //     //state.group.forEach(g => sorters.push(new Sorter(g.key, false, true)));
        //    // state.sort.forEach(s => sorters.push(new Sorter(s.key, s.descending)));
        //     /* =========================
        //     1. GROUPING (FIRST!)
        //     ========================= */
        //   /*  state.group.forEach(g => {
        //         sorters.push(new Sorter(
        //             g.key,
        //             false,
        //             function (oContext) {
        //                 return {
        //                     key: oContext.getProperty(g.key),
        //                     text: g.key + ": " + oContext.getProperty(g.key)
        //                 };
        //             }
        //         ));
        //     }); */
        //     // state.group.forEach(g => {

        //     //     sorters.push(new Sorter(

        //     //         g.key,
        //     //         false,

        //     //         // ✅ use arrow function
        //     //         (oContext) => {

        //     //             const groupValue =
        //     //                 oContext.getProperty(g.key);

        //     //             // ✅ subtotal
        //     //             const subtotal =
        //     //                 this._calculateSubtotal(
        //     //                     g.key,
        //     //                     groupValue
        //     //                 );

        //     //             // ✅ FINAL GROUP HEADER TEXT
        //     //             return {

        //     //                 key: groupValue,

        //     //                 text:
        //     //                     `${groupValue}` +
        //     //                     ` (${subtotal.count})` +
        //     //                     ` | Total Salary: ${subtotal.salary.toLocaleString()}`
        //     //             };
        //     //         }
        //     //     ));
        //     // });
        //     /* =========================
        //     2. NORMAL SORT
        //     ========================= */
        //     state.sort.forEach(s => {
        //         sorters.push(new Sorter(
        //             s.key,
        //             !!s.descending
        //         ));
        //     });
        //     //table.collapseAll();
        //    /* =========================
        //     APPLY SORTERS
        //     ========================= */
        //     binding.sort(sorters);

        //     /* =========================
        //     APPLY GROUPING
        //     ========================= */
        //  /*  if (state.group.length > 0) {

        //     table.setEnableGrouping(true);

        //     const firstGroupKey = state.group[0].key;

        //     const groupColumn = table.getColumns().find(col =>
        //         col.getSortProperty() === firstGroupKey
        //     );

        //     if (groupColumn) {
        //         table.setGroupBy(groupColumn);
        //     }

        // } else {

        //     table.setEnableGrouping(false);
        //     table.setGroupBy(null);
        // } */

        //     const aFilters = [];
        //     const createFilter = (f) => {
        //     if (f.values?.length) {
        //         return new Filter(
        //         f.values.map(v => new Filter(f.key, f.operator || "EQ", v)),
        //         false
        //         );
        //     }
        //     if (f.value1) {
        //         if (f.operator === "BT") {
        //         return new Filter(f.key, "BT", f.value1, f.value2);
        //         }
        //         return new Filter(f.key, f.operator || "EQ", f.value1);
        //     }
        //     return null;
        //     };
        //     state.filter.forEach(f => {
        //     const filter = createFilter(f);
        //     if (filter) aFilters.push(filter);
        //     });
        //     binding.filter(aFilters);          
        //     this._updateDirtyFlag(); // ✅ ADD HERE  
        //     const grandTotal = this._calculateGrandTotal();

        //     if (this._grandTotalText) {

        //         this._grandTotalText.setText(
        //             "Grand Total Salary: " +
        //             grandTotal.toLocaleString()
        //         );
        //     }
        // },
      _applyState: function () {

        if (!this._meta) return;

        const table = this.getAggregation("_table");
        const state = this._stateModel.getData();
        const model = table.getModel();

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

                const meta = this._meta[c.key];

                table.addColumn(new Column({
                    label: meta.label,
                    sortProperty: c.key,
                    filterProperty: c.key,
                    width: c.width,

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
                }));
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
        _openDialog: function () {
            if (!this._dialog) {
                const tabBar = new IconTabBar({
                    items: [this._columnsTab(), this._sortTab(), this._filterTab(), this._groupTab()]
                });
                this._dialog = new Dialog({
                    title: "Grid Settings",
                    contentWidth: "700px",
                    contentHeight: "500px",
                    content: [tabBar],
                    buttons: [
                      new Button(
                        {
                            text: "Apply",
                            press: () => {
                                this._applyState();
                                this._dialog.close();
                            }
                        }
                    ),
                     new sap.m.Button({
                             text: "Save As",
                             icon: "sap-icon://save-as",
                            press: () => {
                                const selected =  this._variantModel.getProperty("/selected");;
                                if (!selected) return;

                                this._saveVariant(selected);
                                this._refreshVariantStore(dialog);
                            }
                           }),
                      new Button({
                        text: "Save New",
                        press: () => this._openSaveDialog()
                        //press: () => this._openVariantManager()
                      }),
                       new Button({
                         text: "Manage Layout",
                        press: () => this._openVariantManager()
                       }),
                      new Button(
                        {
                            text: "Close",
                            press: () => this._dialog.close()
                        }
                    )
                    ]
                });

                this._dialog.setModel(this._stateModel, "state");
            }

            this._dialog.open();
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
               // this._applyState();
            } else {
                this._pendingVariant = sVariantName;
            }
            this._stateModel.refresh(true);

        },
        _columnsTab: function () {
            return new IconTabFilter({
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
                    text: "Sort",
                    content: [
                        new Button({
                            text: "Add",
                            press: () => {
                                const d = this._stateModel.getProperty("/sort");
                                const firstKey = Object.keys(this._meta)[0];
                                d.push({ key: firstKey, descending: false });
                                this._stateModel.refresh(true);
                            }
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
                text: "Filter",
                content: [
                    new Button(
                        {
                            text: "Add",
                            press: () => {
                                const d = this._stateModel.getProperty("/filter");
                                const firstKey = Object.keys(this._meta)[0]; // ✅ pick first column
                                d.push({key: firstKey, operator: "EQ", value1: "",value2: "",  values: [],exclude: false });
                                this._stateModel.refresh(true);
                            }
                        }
                    ),
                    new List(
                        {
                            items: {
                                path: "state>/filter",
                                template: new CustomListItem(
                                    {
                                        content: new HBox(
                                            {
                                                alignItems: "Center",
                                                justifyContent: "Start",
                                                items: [
                                                    // ✅ Operator                   
                                                    new Select(
                                                        {
                                                            selectedKey: "{state>operator}",
                                                            width: "120px",
                                                            items: [
                                                                new Item(
                                                                    {key: "EQ", text: "Equals"}
                                                                ),
                                                                new Item(
                                                                    {key: "Contains", text: "Contains"}
                                                                ),
                                                                new Item(
                                                                    {key: "BT", text: "Between"}
                                                                ),
                                                                new Item(
                                                                    {key: "GT", text: "Greater Than"}
                                                                ),
                                                                new Item(
                                                                    {key: "LT", text: "Less Than"}
                                                                )
                                                            ]
                                                        }
                                                    ),
                                                     // ✅ Field label
                                                    new Select({
                                                      selectedKey: "{state>key}",
                                                      items: this._getItems()
                                                    }),
                                                     // ✅ EXCLUDE toggle (ADD HERE)
                                                    new sap.m.CheckBox({
                                                      text: "Exclude",
                                                      selected: "{state>exclude}",
                                                      visible: false
                                                    }),
                                                    // ✅ Values (tokens + value help)
                                                    this._createValueControl(),

                                                    // ✅ DELETE BUTTON
                                                    new sap.m.Button(
                                                        {
                                                            icon: "sap-icon://delete",
                                                            type: "Transparent",
                                                            press: (e) => {
                                                                const ctx = e.getSource().getBindingContext("state");
                                                                const path = ctx.getPath(); // e.g. "/filter/0"
                                                                const index = parseInt(path.split("/").pop());

                                                                const filters = this._stateModel.getProperty("/filter");
                                                                filters.splice(index, 1); // remove item

                                                                this._stateModel.refresh(true);
                                                            }
                                                        }
                                                    )
                                                ],
                                                renderType: "Bare"
                                            }
                                        ).addStyleClass("sapUiSmallMarginBottom")
                                    }
                                )
                                // option 3:
                                // template:  new sap.m.CustomListItem({
                                //       content: new sap.m.HBox({
                                //           items: [
                                //           new sap.m.Select({
                                //               selectedKey: "{state>key}",
                                //               items: this._getItems(),
                                //               change: (e) => {
                                //               /* const key = e.getSource().getSelectedKey();
                                //               const combo = e.getSource().getParent().getItems()[1];

                                //               const values = this._getUniqueValues(key);

                                //               combo.removeAllItems();
                                //               values.forEach(v => {
                                //                   combo.addItem(new sap.ui.core.Item({ key: v, text: v }));
                                //               }); */
                                //               }
                                //           }),

                                //           this._createValueControl()
                                //           ]
                                //       })
                                //       })
                                // template: new CustomListItem({
                                //     content: new HBox({
                                //       items: [
                                //         new Select({
                                //           selectedKey: "{state>key}",
                                //           items: this._getItems()
                                //         }),
                                //         //option 1:
                                //        // new Input({ value: "{state>value1}" })
                                //        //option 2:
                                //       /*  new sap.m.Input({
                                //             value: "{state>value1}",
                                //             showSuggestion: true,

                                //             suggestionItems: {
                                //                 path: "suggestions>/values",
                                //                 template: new sap.ui.core.Item({
                                //                 text: "{suggestions>value}"
                                //                 })
                                //             },

                                //             suggest: (e) => {
                                //                 const sTerm = e.getParameter("suggestValue");
                                //                 const ctx = e.getSource().getBindingContext("state");
                                //                 const key = ctx.getObject().key;

                                //                 const values = this._getUniqueValues(key)
                                //                 .filter(v => v.toString().toLowerCase().includes(sTerm.toLowerCase()));

                                //                 const oModel = new sap.ui.model.json.JSONModel({
                                //                 values: values.map(v => ({ value: v }))
                                //                 });

                                //                 e.getSource().setModel(oModel, "suggestions");
                                //             }
                                //             }) */

                                //       ]
                                //     })
                                // })
                            }
                        }
                    )
                ]
            });
        },
       _groupTab: function () {
            return new IconTabFilter({
                text: "Group",
                content: [

                    new Button({
                        text: "Add",
                        press: () => {
                            const d = this._stateModel.getProperty("/group");
                            const firstKey = Object.keys(this._meta)[0];

                            d.push({ key: firstKey });

                            this._stateModel.refresh(true);
                        }
                    }),

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
