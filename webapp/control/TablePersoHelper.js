sap.ui.define([
    "sap/ui/base/Object",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Sorter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/Dialog",
    "sap/m/List",
    "sap/m/CustomListItem",
    "sap/m/HBox",
    "sap/m/VBox",
    "sap/m/CheckBox",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/library",
    "sap/m/IconTabBar",
    "sap/m/IconTabFilter",
], function (BaseObject, JSONModel, Sorter, Filter, FilterOperator, Dialog, List,
     CustomListItem, HBox, VBox, CheckBox, Text, Label, Input, Button, Select, 
     Item, MessageBox, MessageToast, coreLibrary,IconTabBar, IconTabFilter) {
    "use strict";

    return BaseObject.extend("com.bosch.rb1m.sd.sd_subcontr.util.TablePersoHelper", {

        /**
         * Constructor
         */
        constructor: function (oTable, aColumnConfig, oODataModel, sDefaultVariant) {
            this._oTable = oTable;
            this._oODataModel = oODataModel || oTable.getModel();
            this._aColumnConfig = aColumnConfig || [];
            
            // Layout customization state model
            this._stateModel = new JSONModel({ columns: [] });
            
            // Separate standalone variant management model
            this._variantModel = new JSONModel({
                variants: [],
                selected: sDefaultVariant || "Standard",
                newVariantName: "",
                setAsDefault: false
            });
            
            this._oDialog = null;
            this._oVariantDialog = null;
            
            this._initDefaultState();
            //this.fetchVariantsFromBackend();
        },

        _initDefaultState: function () {
            if (!this._aColumnConfig || this._aColumnConfig.length === 0) return;

            const aCols = this._aColumnConfig.map((oItem, iIndex) => ({
                key: oItem.key,
                visible: oItem.visible !== undefined ? oItem.visible : true,
                order: oItem.order !== undefined ? oItem.order : iIndex,
                width: oItem.width !== undefined ? oItem.width : "5rem",
                selected: oItem.selected !== undefined ? oItem.selected : true
            }));

            this._stateModel.setProperty("/columns", aCols);
        },

        /**
         * Opens the Main Columns Customization Dialog
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

        /**
         * Main Personalization Dialog Builder
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
                title: "Table Columns Settings",
                contentWidth: "550px",
                contentHeight: "450px",
                draggable: true,
                content: [this._oTabBar],
                buttons: [
                    new Button({
                        text: "Manage Layout",
                        icon: "sap-icon://action-settings",
                        type: "Default",
                        press: () => this.openVariantDialog()
                    }),
                    new Button({
                        text: "Apply Layout",
                        type: "Emphasized",
                        press: () => {
                            this._applyStateToUI5Table();
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
          _getItems: function () {
            return this._aColumnConfig.map(o => new Item({ key: o.key, text: o.label }));
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
        /**
         * OPENS SEPARATE STANDALONE VARIANT DIALOG SCREEN
         */
        openVariantDialog: function () {
            if (!this._oVariantDialog) {
                this._oVariantDialog = this._createVariantDialogStructure();
                this._oVariantDialog.setModel(this._variantModel, "variant");
            }
            this._oVariantDialog.open();
        },

        /**
         * Builds the separate Variant Management layout dialog screen
         */
        _createVariantDialogStructure: function () {
            var oLayoutList = new List({
                headerText: "Available Layout Variants",
                mode: "None",
                items: {
                    path: "variant>/variants",
                    template: new CustomListItem({
                        content: new HBox({
                            justifyContent: "SpaceBetween",
                            alignItems: "Center",
                            width: "100%",
                            items: [
                                new Text({ text: "{variant>text}", design: "Bold" }),
                                new Button({
                                    text: "Load Layout",
                                    icon: "sap-icon://drill-up",
                                    type: "Transparent",
                                    press: (oEvent) => {
                                        var sKey = oEvent.getSource().getBindingContext("variant").getProperty("key");
                                        this._variantModel.setProperty("/selected", sKey);
                                        this.applyBackendVariant(sKey);
                                        this._oVariantDialog.close();
                                    }
                                })
                            ]
                        }).addStyleClass("sapUiSmallMargin")
                    })
                }
            });

            var oInputPanel = new VBox({
                items: [
                    new Label({ text: "Create New Layout Variant Name:", design: "Bold" }).addStyleClass("sapUiSmallMarginTop"),
                    new HBox({
                        width: "100%",
                        alignItems: "Center",
                        items: [
                            new Input({
                                value: "{variant>/newVariantName}",
                                placeholder: "Type layout identity...",
                                width: "60%"
                            }),
                            new CheckBox({
                                text: "Set Default",
                                selected: "{variant>/setAsDefault}"
                            }).addStyleClass("sapUiSmallMarginBegin")
                        ]
                    })
                ]
            }).addStyleClass("sapUiContentPadding");

            return new Dialog({
                title: "Manage Table Layout Variants",
                contentWidth: "450px",
                contentHeight: "400px",
                type: "Message",
                content: [oLayoutList, oInputPanel],
                buttons: [
                    // SAVE AS BUTTON: Updates/Overwrites current selected layout configurations
                    new Button({
                        text: "Save As",
                        icon: "sap-icon://save",
                        type: "Emphasized",
                        tooltip: "Overwrite currently active selected variant settings",
                        press: () => {
                            var sSelectedKey = this._variantModel.getProperty("/selected");
                            if (sSelectedKey === "Standard") {
                                MessageBox.warning("System Standard template cannot be overwritten. Please save a new variant.");
                                return;
                            }
                            this.saveVariantToBackend(sSelectedKey, sSelectedKey, false);
                            this._oVariantDialog.close();
                        }
                    }),
                    // SAVE NEW BUTTON: Generates a completely separate database record entry
                    new Button({
                        text: "Save New",
                        icon: "sap-icon://add",
                        type: "Accept",
                        press: () => {
                            var sNewName = this._variantModel.getProperty("/newVariantName");
                            var bIsDefault = this._variantModel.getProperty("/setAsDefault");
                            if (!sNewName) {
                                MessageToast.show("Please enter a layout name.");
                                return;
                            }
                            this.saveVariantToBackend(sNewName, sNewName, bIsDefault);
                            this._oVariantDialog.close();
                        }
                    }),
                    new Button({
                        text: "Back",
                        press: () => this._oVariantDialog.close()
                    })
                ]
            });
        },

        /* ================================================================= */
        /* ODATA BACKEND INTEGRATION                                         */
        /* ================================================================= */

        fetchVariantsFromBackend: function () {
            var sTableKey = this._oTable.getId().split("---")[1] || "tblsubcon";
            var aFilters = [
                new Filter("AppId", FilterOperator.EQ, "SUBCON_ALV_APP"),
                new Filter("TableId", FilterOperator.EQ, sTableKey)
            ];

            this._oODataModel.read("/TableVariantSet", {
                filters: aFilters,
                success: function (oData) {
                    var aVariants = oData.results.map(function (oItem) {
                        return {
                            key: oItem.VariantId,
                            text: oItem.IsDefault === "X" ? oItem.VariantName + " (Default)" : oItem.VariantName
                        };
                    });

                    if (!aVariants.some(v => v.key === "Standard")) {
                        aVariants.unshift({ key: "Standard", text: "Standard (Default System)" });
                    }

                    this._variantModel.setProperty("/variants", aVariants);

                    var oDefault = oData.results.find(v => v.IsDefault === "X");
                    if (oDefault) {
                        this._variantModel.setProperty("/selected", oDefault.VariantId);
                        this.applyBackendVariant(oDefault.VariantId);
                    }
                }.bind(this),
                error: function () {
                    jQuery.sap.log.error("Could not fetch user variants from SAP OData.");
                }
            });
        },

        saveVariantToBackend: function (sVariantId, sVariantDesc, bIsDefault) {
            var sTableKey = this._oTable.getId().split("---")[1] || "tblsubcon";
            var oCurrentState = this._stateModel.getData();

            var oPayload = {
                AppId: "SUBCON_ALV_APP",
                TableId: sTableKey,
                VariantId: sVariantId,
                VariantName: sVariantDesc,
                IsDefault: bIsDefault ? "X" : "",
                ConfigPayload: JSON.stringify(oCurrentState)
            };

            sap.ui.core.BusyIndicator.show(0);
            this._oODataModel.create("/TableVariantSet", oPayload, {
                success: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageToast.show("Variant saved to database registry.");
                    this._variantModel.setProperty("/newVariantName", "");
                    this.fetchVariantsFromBackend();
                }.bind(this),
                error: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Failed to write layout configurations.");
                }
            });
        },

        applyBackendVariant: function (sVariantId) {
            if (sVariantId === "Standard") {
                this._initDefaultState();
                this._applyStateToUI5Table();
                return;
            }

            var sTableKey = this._oTable.getId().split("---")[1] || "tblsubcon";
            var sKeyPath = this._oODataModel.createKey("/TableVariantSet", {
                AppId: "SUBCON_ALV_APP",
                TableId: sTableKey,
                VariantId: sVariantId
            });

            sap.ui.core.BusyIndicator.show(0);
            this._oODataModel.read(sKeyPath, {
                success: function (oData) {
                    sap.ui.core.BusyIndicator.hide();
                    if (oData && oData.ConfigPayload) {
                        var oSavedState = JSON.parse(oData.ConfigPayload);
                        this._stateModel.setData(oSavedState);
                        this._applyStateToUI5Table();
                    }
                }.bind(this),
                error: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Error reading specific layout configuration.");
                }
            });
        },

        _applyStateToUI5Table: function () {
            var oTable = this._oTable;
            var aColsState = this._stateModel.getProperty("/columns") || [];

            oTable.getColumns().forEach(function (oColumn) {
                var sP13nKey = oColumn.data("p13nKey");
                var oMatch = aColsState.find(c => c.key === sP13nKey);

                if (oMatch) {
                    oColumn.setVisible(oMatch.visible);
                    if (oMatch.width) oColumn.setWidth(oMatch.width);
                }
            });

            var aSortedState = [...aColsState].sort((a, b) => a.order - b.order);
            aSortedState.forEach(function (oColState, iIndex) {
                var oCol = oTable.getColumns().find(c => c.data("p13nKey") === oColState.key);
                if (oCol) {
                    oTable.removeColumn(oCol);
                    oTable.insertColumn(oCol, iIndex);
                }
            });
        },

        /* Layout internal structural utilities */
        _moveColumn: function (iIndex, sDirection) {
            var aCols = this._stateModel.getProperty("/columns");
            if (iIndex < 0 || iIndex >= aCols.length) return;

            var [oMoved] = aCols.splice(iIndex, 1);

            if (sDirection === "first") aCols.unshift(oMoved);
            else if (sDirection === "last") aCols.push(oMoved);
            else if (sDirection === "up") aCols.splice(Math.max(0, iIndex - 1), 0, oMoved);
            else if (sDirection === "down") aCols.splice(Math.min(aCols.length, iIndex + 1), 0, oMoved);

            aCols.forEach((c, i) => c.order = i);
            this._stateModel.refresh(true);
        },

        _getIndex: function (oEvent) {
            return parseInt(oEvent.getSource().getBindingContext("state").getPath().split("/").pop(), 10);
        },

        _getIndexFromItem: function (item) {
            return parseInt(item.getBindingContext("state").getPath().split("/").pop(), 10);
        },

        _reorderByDrag: function (from, to) {
            var cols = this._stateModel.getProperty("/columns");
            var [moved] = cols.splice(from, 1);
            cols.splice(to, 0, moved);
            cols.forEach((c, i) => c.order = i);
            this._stateModel.refresh(true);
        }
    });
});
