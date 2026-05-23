sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Sorter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Dialog",
    "sap/m/IconTabBar",
    "sap/m/IconTabFilter",
    "sap/m/List",
    "sap/m/CustomListItem",
    "sap/m/HBox",
    "sap/m/VBox",
    "sap/m/CheckBox",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/Select",
    "sap/m/Switch",
    "sap/m/Button",
    "sap/ui/core/Item"
], function (BaseObject, JSONModel, Sorter, Filter, FilterOperator, Dialog, IconTabBar, IconTabFilter, List, CustomListItem, HBox, VBox, CheckBox, Text, Label, Input, Select, Switch, Button, Item) {
    "use strict";

    return BaseObject.extend("com.bosch.rb1m.sd.sd_subcontr.util.TablePersoHelper", {

        /**
         * Constructor
         * @param {sap.ui.table.Table} oTable Target layout grid UI element instance to handle settings variants
         * @param {Array} aColumnConfig Standard Array structure sample block configuration format: [{ key: 'TRAFF_LGT', label: 'Traffic Light' }]
         */
        constructor: function (oTable, aColumnConfig, oDataModel, oDefaultVariant) {
            this._oTable = oTable;
            this._oTableModel = oDataModel || oTable.getModel();
            this._aColumnConfig = aColumnConfig || []; // Kept as standard sequential configuration array
            // State Tracking Model setup using the "state>" mapping context namespace
            this._stateModel = new JSONModel({ columns: [], sort: [], filter: [], group: [] });
            this._originalState = JSON.stringify({ columns: [], sort: [], filter: [], group: [] });         
            this._variantModel = new JSONModel({
                variants: [],
                selected: ""
            });
            this._oDialog = null;
            // Load saved local presets and initialize defaults
            this._loadVariantsToModel();
            this._initDefaultState();
            // Track state modifications dynamically
            this._stateModel.attachPropertyChange(() => {
                this._updateDirtyFlag();
            });
        },
        /**
         * Parses input configuration array items sequence parameters cleanly into structural models mapping fields
         */
        _initDefaultState: function () {
            if (!this._aColumnConfig || this._aColumnConfig.length === 0) return;

            // Map standard sequential properties arrays into persistent properties fields structures
            const aCols = this._aColumnConfig.map((oItem, iIndex) => ({
                key: oItem.key,
                visible: oItem.visible !== undefined ? oItem.visible : true,
                order: oItem.order !== undefined ? oItem.order : iIndex,
                width: oItem.width !== undefined ? oItem.width : "5rem",
                selected: oItem.selected !== undefined ? oItem.selected : iIndex === 0
            }));

            this._stateModel.setProperty("/columns", aCols);
            this._stateModel.setProperty("/sort", []);
            this._stateModel.setProperty("/filter", []);
            this._stateModel.setProperty("/group", []);
            
            this._originalState = JSON.stringify(this._stateModel.getData());

            const sDefaultKey = this._variantModel.getProperty("/selected");
            if (sDefaultKey) {
                this._loadVariant(sDefaultKey);
            }
        },

        /**
         * Contextual Dialog routing entry point wrapper
         * @param {string} [sTabKey] Explicit selection focus override pointer ("column", "sort", "filterTab", "group")
         */
        openDialog: function (sTabKey) {
            if (!this._oDialog) {
                this._oDialog = this._createDialogStructure();
                this._oDialog.setModel(this._stateModel, "state");
                this._oDialog.setModel(this._variantModel, "variant");
            }

            if (sTabKey && this._oTabBar) {
                this._oTabBar.setSelectedKey(sTabKey);
                this._oTabBar.getItems().forEach(item => {
                    if (item.getKey() === "sortTab" || item.getKey() === "filterTab" || item.getKey() === "groupTab") {
                        item.setVisible(false);
                    }
                });
            }

            this._oDialog.open();
        },
       
    _columnsTab: function () {
            return new IconTabFilter({
                key: "columnTab",
                text: "Columns",
                content: [new List({
                    mode: "SingleSelectMaster",
                    includeItemInSelection: true, 
                    items: {
                        path: "state>/columns",
                        sorter: new sap.ui.model.Sorter("order", false),
                        template: new CustomListItem({
                            highlight: {
                                path: "state>selected",
                                formatter: (bSelected) => bSelected ? "Information" : "None"
                            },
                            content: new HBox({
                                alignItems: "Center",
                                justifyContent: "SpaceBetween",
                                width: "100%",
                                items: [
                                    // LEFT SIDE ZONE
                                    new HBox({
                                        alignItems: "Center",
                                        width: "70%", 
                                        items: [
                                            // COLUMN 0: Checkbox with dynamic suffixing
                                            new CheckBox({
                                                id: this.createId ? this.createId("perso_cb") : undefined, // Safeguard standard view IDs
                                                selected: "{state>selected}",
                                                select: (oEvent) => {
                                                    const ctx = oEvent.getSource().getBindingContext("state");
                                                    const obj = ctx.getObject();
                                                    obj.selected = oEvent.getParameter("selected");
                                                    obj.visible =  obj.selected;
                                                    this._stateModel.refresh(true);
                                                }
                                            }).setLayoutData(new sap.m.FlexItemData({ baseSize: "40px" })),

                                            // COLUMN 1: The Field Name Value
                                            new Text({ 
                                                text: "{state>key}",
                                                wrapping: false
                                            }).setLayoutData(new sap.m.FlexItemData({ 
                                                growFactor: 1,
                                                baseSize: "60%" 
                                            })).addStyleClass("sapUiSmallMarginEnd"),

                                            // COLUMN 2: The Width Value (Aligned cleanly)
                                            new Input({ 
                                                value: "{state>width}", 
                                                width: "80px" 
                                            }).setLayoutData(new sap.m.FlexItemData({
                                                baseSize: "40%"
                                            })).addStyleClass("sapUiMediumMarginEnd")
                                        ]
                                    }),
                                    
                                    // RIGHT SIDE ZONE (Buttons)
                                    new HBox({
                                        visible: "{= ${state>selected} === true }",
                                        alignItems: "Center",
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
                        }).addStyleClass("columnRow") 
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
                }).addStyleClass("columnRow")]
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
        /**
         * Translates metadata configurations seamlessly into structural dialog tabs configurations
         */
        _createDialogStructure: function () {
            this._oTabBar = new IconTabBar({
                expandable: false,
                items: [
                    // --- TAB 1: COLUMNS DISPLAY VISIBILITY ---
                    this._columnsTab().setKey("columnTab"),               
                    // --- TAB 2: LEVEL SELECT SORT MAPPERS ---
                    this._sortTab().setKey("sortTab"),
                    // --- TAB 3: DYNAMIC RULES VALUE-HELP FILTERS ---
                    this._filterTab().setKey("filterTab"),
                    // --- TAB 4: ALV MANUALLY TRIGGERED MULTI-GROUP RULES ---
                    this._groupTab().setKey("groupTab")
                ]
            });

            return new Dialog({
                title: "View Settings",
                contentWidth: "650px", contentHeight: "500px",
                draggable: true, resizable: true,
                content: [this._oTabBar],
                buttons: [
                    new Button({
                        text: "Apply", type: "Emphasized",
                        press: () => {
                            this._applyState();
                            this._oDialog.close();
                        }
                    }),
                    new Button({
                        text: "Close",
                        press: () => this._oDialog.close()
                    })
                ]
            });
        },

        /**
         * Built to handle dynamic, unlimited rule creation filtering logic blocks perfectly
         */
        _filterTab: function () {
            return new IconTabFilter({
                key: "filterTab",
                text: "Filters",
                visible: false, // Set to true if filter tab should be available
                content: [
                    new sap.m.OverflowToolbar({
                        content: [
                            new sap.m.ToolbarSpacer(),
                            new Button({
                                text: "Add Filter", icon: "sap-icon://add", type: "Emphasized",
                                press: () => {
                                    const d = this._stateModel.getProperty("/filter") || [];
                                    const firstKey = this._aColumnConfig[0]?.key || "TRAFF_LGT"; 
                                    d.push({
                                        key: firstKey,
                                        operator: "EQ",
                                        value1: "", value2: "",
                                        values: [], exclude: false
                                    });
                                    this._stateModel.setProperty("/filter", d);
                                    this._stateModel.refresh(true);
                                }
                            })
                        ]
                    }),

                    new List({
                        id:  this.createId ? this.createId("perso_filterColumnList") : undefined,
                        noDataText: "No filters defined. Click 'Add Filter' to begin.",
                        items: {
                            path: "state>/filter",
                            template: new CustomListItem({
                                content: new HBox({
                                    alignItems: "Center", justifyContent: "Start",
                                    items: [
                                        new Select({
                                            selectedKey: "{state>operator}", width: "120px",
                                            change: () => this._stateModel.refresh(true),
                                            items: [
                                                new Item({key: "EQ", text: "Equals"}),
                                                new Item({key: "Contains", text: "Contains"}),
                                                new Item({key: "BT", text: "Between"}),
                                                new Item({key: "GT", text: "Greater Than"}),
                                                new Item({key: "LT", text: "Less Than"})
                                            ]
                                        }).addStyleClass("sapUiTinyMarginEnd"),

                                        new Select({
                                            selectedKey: "{state>key}", width: "180px",
                                            items: this._getItems(),
                                            change: () => this._stateModel.refresh(true)
                                        }).addStyleClass("sapUiTinyMarginEnd"),

                                        this._createValueControl(),

                                        new sap.m.ToolbarSpacer(),

                                        new sap.m.Button({
                                            icon: "sap-icon://delete", type: "Transparent",
                                            press: (e) => {
                                                const ctx = e.getSource().getBindingContext("state");
                                                const index = parseInt(ctx.getPath().split("/").pop());
                                                const filters = this._stateModel.getProperty("/filter");
                                                filters.splice(index, 1);
                                                this._stateModel.setProperty("/filter", filters);
                                                this._stateModel.refresh(true);
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

        _createValueControl: function () {
            return new HBox({
                alignItems: "Center",
                items: [
                    new Input({
                        value: "{state>value1}", placeholder: "Select criteria...", width: "160px",
                        showValueHelp: true,
                        valueHelpRequest: (oEvt) => this._onFilterValueHelpRequest(oEvt, "value1"),
                        visible: { path: "state>operator", formatter: (op) => op !== "BT" }
                    }),
                    new HBox({
                        alignItems: "Center",
                        visible: { path: "state>operator", formatter: (op) => op === "BT" },
                        items: [
                            new Input({
                                value: "{state>value1}", placeholder: "From...", width: "110px",
                                showValueHelp: true, valueHelpRequest: (oEvt) => this._onFilterValueHelpRequest(oEvt, "value1")
                            }).addStyleClass("sapUiTinyMarginEnd"),
                            new Label({ text: "to" }).addStyleClass("sapUiTinyMarginEnd"),
                            new Input({
                                value: "{state>value2}", placeholder: "To...", width: "110px",
                                showValueHelp: true, valueHelpRequest: (oEvt) => this._onFilterValueHelpRequest(oEvt, "value2")
                            })
                        ]
                    })
                ]
            });
        },

        _onFilterValueHelpRequest: function (oEvent, sFieldTarget) {
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext("state");
            const sKey = oContext.getProperty("key");
            const sLabel = this._getLabelByKey(sKey);

            const oTableModel = this._oTableModel;
            if (!oTableModel) return;
            
            const aRows = oTableModel.getProperty("/ItemsSet") || oTableModel.getProperty("/rows") || [];
            const aUnique = [...new Set(aRows.map(r => r[sKey]).filter(v => v !== undefined && v !== null && v !== ""))].sort();

            const oVhModel = new JSONModel({ items: aUnique.map(v => ({ value: v })) });
            const oSelectDialog = new sap.m.SelectDialog({
                title: `Select Value for ${sLabel}`,
                rememberSelections: false,
                items: { path: "/items", template: new sap.m.StandardListItem({ title: "{value}", type: "Active" }) },
                search: (oSearchEvt) => {
                    const sVal = oSearchEvt.getParameter("value");
                    const oFilter = sVal ? new Filter("value", FilterOperator.Contains, sVal) : [];
                    oSearchEvt.getSource().getBinding("items").filter(oFilter);
                },
                confirm: (oConfirmEvt) => {
                    const oSel = oConfirmEvt.getParameter("selectedItem");
                    if (oSel) {
                        oContext.getModel().setProperty(`${oContext.getPath()}/${sFieldTarget}`, oSel.getTitle());
                        this._stateModel.refresh(true);
                    }
                    oSelectDialog.destroy();
                },
                cancel: () => oSelectDialog.destroy()
            });

            oSelectDialog.setModel(oVhModel);
            oSelectDialog.open();
        },

        _getItems: function () {
            return this._aColumnConfig.map(o => new Item({ key: o.key, text: o.label }));
        },

        _getLabelByKey: function (sKey) {
            const match = this._aColumnConfig.find(o => o.key === sKey);
            return match ? match.label : sKey;
        },

        _onMoveColumnPress: function (oEvent, sDirection) {
            const oItem = oEvent.getSource().getParent().getParent().getParent();
            const iIndex = oItem.getParent().indexOfItem(oItem);
            const aCols = this._stateModel.getProperty("/columns");
            if (iIndex === -1) return;

            let iNewIndex = sDirection === "up" ? iIndex - 1 : iIndex + 1;
            if (iNewIndex < 0 || iNewIndex >= aCols.length) return;

            const [moved] = aCols.splice(iIndex, 1);
            aCols.splice(iNewIndex, 0, moved);

            aCols.forEach((c, i) => c.order = i);
            this._stateModel.refresh(true);
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
        _onSortDropdownChange: function (oEvent) {
            const sSel = oEvent.getParameter("selectedItem").getKey();
            const sKey = oEvent.getSource().getBindingContext("state").getProperty("key");
            let aSorts = this._stateModel.getProperty("/sort") || [];

            aSorts = aSorts.filter(s => s.key !== sKey);
            if (sSel !== "None") {
                aSorts.push({ key: sKey, descending: sSel === "Descending" });
            }
            this._stateModel.setProperty("/sort", aSorts);
        },

        _onGroupSwitchToggle: function (oEvent) {
            const bState = oEvent.getParameter("state");
            const sKey = oEvent.getSource().getBindingContext("state").getProperty("key");
            let aGroups = this._stateModel.getProperty("/group") || [];

            aGroups = aGroups.filter(g => g.key !== sKey);
            if (bState) {
                aGroups.push({ key: sKey });
            }
            this._stateModel.setProperty("/group", aGroups);
        },

        // =========================================================================
        // PERFORMANCE MUTATION PIPELINE (MUTATES EXISTING COLUMNS SAFELY IN PLACE)
        // =========================================================================
        _applyState: function () {
            const oTable = this._oTable;
            const oState = this._stateModel.getData();
            const oModel = this._oTableModel;
            if (!oModel) return;

            let aRows = oModel.getProperty("/ItemsSet") || oModel.getProperty("/rows") || [];
            if (!Array.isArray(aRows)) return;
            aRows = [...aRows];

            // 1. RUN CUSTOM FILTER OPERATIONS
            oState.filter.forEach(f => {
                if (f.value1) {
                    const sV1 = String(f.value1).toLowerCase();
                    const sV2 = f.value2 ? String(f.value2).toLowerCase() : "";

                    aRows = aRows.filter(oItem => {
                        const sTarget = String(oItem[f.key] || "").toLowerCase();
                        switch (f.operator) {
                            case "Contains": return sTarget.includes(sV1);
                            case "EQ":       return sTarget === sV1;
                            case "GT":       return sTarget > sV1;
                            case "LT":       return sTarget < sV1;
                            case "BT":       return sTarget >= sV1 && sTarget <= sV2;
                            default:         return sTarget.includes(sV1);
                        }
                    });
                }
            });

            // 2. RUN SORT CRITERIA MUTATIONS
            oState.sort.forEach(s => {
                const sKey = s.key, bDesc = !!s.descending;
                aRows.sort((a, b) => {
                    if (a[sKey] === b[sKey]) return 0;
                    return bDesc ? (a[sKey] < b[sKey] ? 1 : -1) : (a[sKey] > b[sKey] ? 1 : -1);
                });
            });

            // 3. 🌟 IN-PLACE COLUMN MUTATION & POSITION SHIFT ENGINE (WITHOUT TEARDOWN) 🌟
            const aExistingColumns = oTable.getColumns();

            oState.columns
                .filter(c => c.visible)
                .sort((a, b) => a.order - b.order)
                .forEach((c, iNewIndex) => {
                    const oTargetCol = aExistingColumns.find(col => col.data("p13nKey") === c.key);
                    if (oTargetCol) {
                        oTargetCol.setVisible(true);
                        oTargetCol.setWidth(c.width);
                        // Sync Sort State Visual Markers
                        const oSortInfo = oState.sort.find(s => s.key === c.key);
                        oTargetCol.setSorted(!!oSortInfo);
                        oTargetCol.setSortOrder(oSortInfo ? (oSortInfo.descending ? "Descending" : "Ascending") : "None");

                        // Reorder column inside array aggregation safely if position index shifted
                        if (oTable.indexOfColumn(oTargetCol) !== iNewIndex) {
                            oTable.removeColumn(oTargetCol);
                            oTable.insertColumn(oTargetCol, iNewIndex);
                        }
                    }
                });

            // Hide columns marked invisible
            oState.columns.filter(c => !c.visible).forEach(c => {
                const oTargetCol = aExistingColumns.find(col => col.data("p13nKey") === c.key);
                if (oTargetCol) {
                    oTargetCol.setVisible(false);
                }
            });

            // Update models data arrays endpoints
            oModel.setProperty("/ItemsSet", aRows);
            oModel.setProperty("/rows", aRows);
            
            if (oTable.getBinding("rows")) {
                oTable.getBinding("rows").refresh(true);
            }
            this._updateDirtyFlag();
        },

        // =========================================================================
        // PERSISTENCE LOCAL STORAGE & DIRTY CHECK POINTERS
        // =========================================================================
        _isDirty: function () {
            return JSON.stringify(this._stateModel.getData()) !== this._originalState;
        },

        _updateDirtyFlag: function () {
            const sSelected = this._variantModel.getProperty("/selected");
            if (!sSelected) return;
            const bDirty = this._isDirty();
            const aVariants = this._variantModel.getProperty("/variants") || [];
            
            const aUpdated = aVariants.map(v => {
                const sCleanKey = v.key.replace(" *", "");
                if (sCleanKey === sSelected) {
                    return { key: sCleanKey, text: bDirty ? sCleanKey + " *" : sCleanKey };
                }
                return { key: sCleanKey, text: sCleanKey };
            });
            this._variantModel.setProperty("/variants", aUpdated);
        },

        _loadVariantsToModel: function () {
            let mAll = JSON.parse(localStorage.getItem("subcon_variants") || "{}");
            if (!mAll["Standard"]) {
                mAll["Standard"] = { columns: [], sort: [], filter: [], group: [] };
                localStorage.setItem("subcon_variants", JSON.stringify(mAll));
            }
            const aNames = Object.keys(mAll);
            this._variantModel.setData({
                variants: aNames.map(n => ({ key: n, text: n })),
                selected: "Standard"
            });
        },

        _loadVariant: function (sVariantName) {
            const mAll = JSON.parse(localStorage.getItem("subcon_variants") || "{}");
            const oTargetData = mAll[sVariantName];
            if ( oTargetData.columns.length <= 0) return;

            this._stateModel.setData(jQuery.extend(true, {}, oTargetData));
            this._originalState = JSON.stringify(this._stateModel.getData());
            this._variantModel.setProperty("/selected", sVariantName);
            this._updateDirtyFlag();
        },

        getId: function() {
            return this._oTable ? this._oTable.getId() + "_perso" : "subcon_perso";
        }
    });
});
