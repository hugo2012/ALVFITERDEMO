sap.ui.define([
  "sap/ui/core/mvc/Controller"
], function (Controller) {
  "use strict";

  return Controller.extend("com.grid.alvdemo.controller.Main", {

    onInit: function () {
      const oTable = this.byId("alvTable");

      // 🔹 Column Metadata (ALV Field Catalog)
      oTable.setColumnMeta({
        Name: { label: "Name", width: "150px" },
        Age: { label: "Age" },
        Department: { label: "Department" },
        Salary: { label: "Salary" }
      });

      // 🔹 Sample Data
      oTable.setData([
        { Name: "John", Age: 30, Department: "IT", Salary: 5000 },
        { Name: "Anna", Age: 25, Department: "HR", Salary: 4000 },
        { Name: "Mike", Age: 40, Department: "Finance", Salary: 7000 },
        { Name: "Sara", Age: 35, Department: "IT", Salary: 6500 }
      ]);
    }

  });
});