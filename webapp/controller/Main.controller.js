sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller,JSONModel, MessageToast) {
  "use strict";

  return Controller.extend("com.grid.alvdemo.controller.Main", {
    // Temporary storage acting as our application clipboards

    onInit: function () {

      // Mock Data Sample
            // Mock data structure mimicking your UI matrix
            var oData = {
                items: [
                    { id: "P001", name: "Wireless Mouse", category: "Electronics", price: "25.00" },
                    { id: "P002", name: "Mechanical Keyboard", category: "Electronics", price: "85.00" },
                    { id: "P003", name: "Office Chair", category: "Furniture", price: "150.00" },
                    { id: "P004", name: "", category: "", price: "" },
                    { id: "P005", name: "", category: "", price: "" }
                ]
            };
            var oModel = new JSONModel(oData);
            this.getView().setModel(oModel, "products");

        this._oUIDynamicTable = this.byId("alvTable");

      // 🔹 Column Metadata (ALV Field Catalog)
      this._oUIDynamicTable.setColumnMeta({
        Name: { label: "Name", width: "150px" },
        Age: { label: "Age" },
        Department: { label: "Department" },
        Salary: { label: "Salary" }
      });

      // 🔹 Sample Data
      this._oUIDynamicTable.setData([
        { Name: "John", Age: 30, Department: "IT", Salary: 5000 },
        { Name: "Anna", Age: 25, Department: "HR", Salary: 4000 },
        { Name: "Mike", Age: 40, Department: "Finance", Salary: 7000 },
        { Name: "Sara", Age: 35, Department: "IT", Salary: 6500 }
      ]);
    },
    initPersonalization: function () {
            this._aColumnConfig = [
                { key: 'TRAFF_LGT', label: 'Traffic Light', visible: true, order: 1, width: "3rem", selected: true},
                { key: 'SUPP_NO', label: 'Supplier Number', visible: true, order: 2, width: "5rem", selected: true},
                { key: 'SUPP_NAME', label: 'Supplier Name', visible: true, order: 3, width: "5rem", selected: true},
                { key: 'SUPP_CITY', label: 'Supplier City', visible: true, order: 4, width: "5rem", selected: true},
                { key: 'SUPP_CTRY', label: 'Supplier Country', visible: true, order: 5, width: "4rem", selected: true},
                { key: 'PO_NO', label: 'Purchase Document', visible: true, order: 6, width: "5rem", selected: true},
                { key: 'ASSE_PRD', label: 'Assembly Product', visible: true, order: 7, width: "8rem", selected: true},
                { key: 'PRD_DESCR', label: 'Product Description', visible: true, order: 8, width: "8rem", selected: true},
                { key: 'COMPONENT', label: 'Component', visible: true, order: 9, width: "8rem", selected: true},
                { key: 'COMP_DESCR', label: 'Component Description', visible: true, order: 10, width: "8rem", selected: true},
                { key: 'STOCK', label: 'Stock', visible: true, order: 11, width: "5rem", selected: true},
                { key: 'UOM', label: 'Unit Of Measure', visible: true, order: 12, width: "4rem", selected: true},
                { key: 'SUM_HU', label: 'Sum. HU', visible: true, order: 13, width: "5rem", selected: true},
                { key: 'STOCK_SUPP', label: 'Stock At Supplier', visible: true, order: 14, width: "5rem", selected: true},
                { key: 'BEN', label: '.', visible: true, order: 14, width: "3rem", selected: true},
                { key: 'DEMAND', label: 'Demand', visible: true, order: 15, width: "5rem", selected: true},
                { key: 'SHIP_TO', label: 'Ship To Party', visible: true, order: 16, width: "7rem", selected: true}
            ];

            // Pass the primary OData Model for OData Variant persistence
            var oBackendODataModel = this.getOwnerComponent().getModel(); 
            this._oSubconPersoHelper = new TablePersoHelper(this._oUIDynamicTable, this._aColumnConfig, oBackendODataModel, "Standard");
        },

        openPersoDialog: function (oEvt) {
            if (this._oSubconPersoHelper) {
                this._oSubconPersoHelper.openDialog();
            }
        },

        /* =========================================================== */
        /* ROW COPY / PASTE FUNCTIONALITY                              */
        /* =========================================================== */

       onAfterRendering: function () {
            var oTable = this.byId("productsTable");
            var oTableDom = oTable.getDomRef();

            if (oTableDom) {
                // Attach native paste event to the table DOM element
                oTableDom.addEventListener("paste", this.handlePaste.bind(this));
            }
        },

      handlePaste_full_static: function (oEvent) {
            // 1. Prevent default paste behavior
            oEvent.preventDefault();

            // 2. Get clipboard text data
            var sClipboardData = (oEvent.clipboardData || window.clipboardData).getData("text");
            if (!sClipboardData) { return; }

            // 3. Parse Excel data
            var aRows = sClipboardData.split(/\r?\n/);
            if (aRows[aRows.length - 1] === "") {
                aRows.pop();
            }

            var oTable = this.byId("productsTable");
            var oModel = this.getView().getModel("products");
            var aTableData = oModel.getProperty("/items");
            
            var iStartIndex = 0; 

            // --- FIX APPLIED HERE ---
            // 4. Get the native focused DOM element
            var oActiveHtmlElement = document.activeElement;
            
            // Use SAPUI5's jQuery extension to get the control instance from the DOM element
            var oFocusedElement = oActiveHtmlElement ? jQuery(oActiveHtmlElement).control(0) : null;
            
            if (oFocusedElement) {
                var oBindingContext = oFocusedElement.getBindingContext("products");
                if (oBindingContext) {
                    var sPath = oBindingContext.getPath();
                    iStartIndex = parseInt(sPath.substring(sPath.lastIndexOf("/") + 1), 10);
                }
            } else if (oTable.getSelectedItems().length > 0) {
                var oFirstSelected = oTable.getSelectedItems()[0];
                iStartIndex = oTable.indexOfItem(oFirstSelected);
            }
            // ------------------------

            // 5. Map Excel keys to your JSON Model properties
            var aPropertyKeys = ["id", "name", "category", "price"];

            // 6. Loop and insert data into the model array
            aRows.forEach(function (sRowData, iRowOffset) {
                var iTargetIndex = iStartIndex + iRowOffset;
                
                if (iTargetIndex >= aTableData.length) {
                    aTableData.push({ id: "", name: "", category: "", price: "" });
                }

                var aCells = sRowData.split("\t");
                aCells.forEach(function (sCellValue, iColIndex) {
                    if (iColIndex < aPropertyKeys.length) {
                        var sKey = aPropertyKeys[iColIndex];
                        aTableData[iTargetIndex][sKey] = sCellValue;
                    }
                });
            });

            // 7. Refresh model to update the screen
            oModel.refresh(true);
        },
        handlePaste: function (oEvent) {
            // 1. Prevent default browser paste behavior
            oEvent.preventDefault();

            // 2. Get clipboard text data
            var sClipboardData = (oEvent.clipboardData || window.clipboardData).getData("text");
            if (!sClipboardData) { return; }

            // 3. Parse Excel data (Rows split by Newline, Columns split by Tabs)
            var aRows = sClipboardData.split(/\r?\n/);
            if (aRows[aRows.length - 1] === "") {
                aRows.pop();
            }

            var oTable = this.byId("productsTable");
            var oModel = this.getView().getModel("products");
            var aTableData = oModel.getProperty("/items");
            
            // Default fallback indices
            var iStartRowIndex = 0; 
            var iStartColIndex = 0; 

            // 4. Find the focused HTML element and its corresponding UI5 Control
            var oActiveHtmlElement = document.activeElement;
            var oFocusedElement = oActiveHtmlElement ? jQuery(oActiveHtmlElement).control(0) : null;
            
            if (oFocusedElement) {
                // --- DYNAMIC ROW INDEX ---
                var oBindingContext = oFocusedElement.getBindingContext("products");
                if (oBindingContext) {
                    var sPath = oBindingContext.getPath(); // e.g., "/items/2"
                    iStartRowIndex = parseInt(sPath.substring(sPath.lastIndexOf("/") + 1), 10);
                }

                // --- DYNAMIC COLUMN INDEX ---
                // Find the ColumnListItem (the row container) of the focused Input
                var oRowContainer = oFocusedElement.getParent(); 
                if (oRowContainer && typeof oRowContainer.indexOfCell === "function") {
                    // Get the index of the focused Input within the row's cells array
                    iStartColIndex = oRowContainer.indexOfCell(oFocusedElement);
                }
            } else if (oTable.getSelectedItems().length > 0) {
                // Fallback to first selected row if no specific cell is focused
                var oFirstSelected = oTable.getSelectedItems()[0];
                iStartRowIndex = oTable.indexOfItem(oFirstSelected);
            }

            // 5. Hardcoded map of your properties in the EXACT order they appear in the XML view columns
            var aPropertyKeys = ["id", "name", "category", "price"];

            // 6. Loop through Excel rows and paste dynamically
            aRows.forEach(function (sRowData, iRowOffset) {
                var iTargetRowIndex = iStartRowIndex + iRowOffset;
                
                // If Excel has more rows than the table currently has, append a new blank row object
                if (iTargetRowIndex >= aTableData.length) {
                    aTableData.push({ id: "", name: "", category: "", price: "" });
                }

                var aCells = sRowData.split("\t");
                aCells.forEach(function (sCellValue, iColOffset) {
                    // Calculate target column based on where the user clicked + Excel column offset
                    var iTargetColIndex = iStartColIndex + iColOffset;

                    // Ensure we don't accidentally write past the last available column
                    if (iTargetColIndex < aPropertyKeys.length) {
                        var sKey = aPropertyKeys[iTargetColIndex];
                        aTableData[iTargetRowIndex][sKey] = sCellValue;
                    }
                });
            });

            // 7. Refresh model to push changes to the UI matrix
            oModel.refresh(true);
        }

  });
});
