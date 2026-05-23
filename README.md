## Application Details
|               |
| ------------- |
|**Generation Date and Time**<br>Mon May 04 2026 13:31:30 GMT+0000 (Coordinated Universal Time)|
|**App Generator**<br>SAP Fiori Application Generator|
|**App Generator Version**<br>1.23.0|
|**Generation Platform**<br>SAP Business Application Studio|
|**Template Used**<br>Basic|
|**Service Type**<br>None|
|**Service URL**<br>N/A|
|**Module Name**<br>alvdemo|
|**Application Title**<br>Alv grid filter|
|**Namespace**<br>com.grid|
|**UI5 Theme**<br>sap_horizon|
|**UI5 Version**<br>1.147.2|
|**Enable TypeScript**<br>False|
|**Add Eslint configuration**<br>True, see https://www.npmjs.com/package/@sap-ux/eslint-plugin-fiori-tools#rules for the eslint rules.|

## alvdemo

Alv grid filter

### Starting the generated app

-   This app has been generated using the SAP Fiori tools - App Generator, as part of the SAP Fiori tools suite.  To launch the generated application, run the following from the generated application root folder:

```
    npm start
```
### Delete Existing Dependencies:
In the terminal, run: rm -rf node_modules

Clear npm Cache: Run: npm cache clean --force

Reinstall Dependencies: Run: npm install

#### Pre-requisites:

1. Active NodeJS LTS (Long Term Support) version and associated supported NPM version.  (See https://nodejs.org)

### Plug and Play custom TablePersoHelper
  initPersonalization: function () {
          // 🌟 STEP 2.A: CUSTOM INLINE CONFIGURATION FOR TABLE 1 (Main Subcon Table)
            this._aColumnConfig = [
                { key: 'TRAFF_LGT', label: 'Traffic Light',visible: true ,order: 1,width: "3rem",selected: true},
                { key: 'SUPP_NO', label: 'Supplier Number',visible: true ,order: 2,width: "5rem",selected: true},
                { key: 'SUPP_NAME', label: 'Supplier Name',visible: true ,order: 3,width: "5rem",selected: true},
                { key: 'SUPP_CITY', label: 'Supplier City',visible: true ,order: 4,width: "5rem",selected: true},
                { key: 'SUPP_CTRY', label: 'Supplier Country',visible: true ,order: 5,width: "4rem",selected: true},
                { key: 'PO_NO', label: 'Purchase Document',visible: true ,order: 6,width: "5rem",selected: true},
                { key: 'ASSE_PRD', label: 'Assembly Product',visible: true ,order: 7,width: "8rem",selected: true},
                { key: 'PRD_DESCR', label: 'Product Description',visible: true ,order: 8,width: "8rem",selected: true},
                { key: 'COMPONENT', label: 'Component',visible: true ,order: 9,width: "8rem",selected: true},
                { key: 'COMP_DESCR', label: 'Component Description',visible: true ,order: 10,width: "8rem",selected: true},
                { key: 'STOCK', label: 'Stock',visible: true ,order: 11,width: "5rem",selected: true},
                { key: 'UOM', label: 'Unit Of Measure',visible: true ,order: 12,width: "4rem",selected: true},
                { key: 'SUM_HU', label: 'Sum. HU',visible: true ,order: 13,width: "5rem",selected: true},
                { key: 'STOCK_SUPP', label: 'Stock At Supplier',visible: true ,order: 14,width: "5rem",selected: true},
                { key: 'BEN', label: '.',visible: true ,order: 14,width: "3rem",selected: true},
                { key: 'DEMAND', label: 'Demand',visible: true ,order: 15, width: "5rem",selected: true},
                { key: 'SHIP_TO', label: 'Ship To Party',visible: true ,order: 16,width: "7rem",selected: true}
            ];

            // Instantiate Helper for Table 1
           // this._oSubconPersoHelper = new TablePersoHelper(this._oUIDynamicTable, this._aColumnConfig,this.getModel("subconModel"),"Standard");
           // Pass the primary OData Model for OData Variant persistence
            var oBackendODataModel = this.getOwnerComponent().getModel("mainService"); 
            this._oSubconPersoHelper = new TablePersoHelper(this._oUIDynamicTable, this._aColumnConfig, oBackendODataModel, "Standard"); 
        },
         /**
         * Settings handler for Table 1 (Main Subcon Table)
         */
        openPersoDialog: function (oEvt) {
            if (this._oSubconPersoHelper) {
                this._oSubconPersoHelper.openDialog("column");
                //this._oSubconPersoHelper.openDialog("column");
            }
        },


