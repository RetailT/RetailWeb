import React, { useState } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const NestedDynamicTable = ({ data, mainHeadings, title }) => {
  const [selectedType, setSelectedType] = useState("");
  const [typeError, setTypeError] = useState("");
  const typeOptions = ["PDF", "EXCEL"];

  // Ensure data exists
  if (!data || data.length === 0) {
    return <p>No data available</p>;
  }

  // Format function for Amount
  const formatAmount = (value) => {
    if (!value) return "0.00"; // Handle empty or null values
    const num = parseFloat(value); // Ensure the value is a number
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const exportToExcel = () => {
    const sheetData = [];

    // Add main headings
    const mainHeadingsRow = mainHeadings.map((main) => main.label);
    sheetData.push(mainHeadingsRow);

    // Add subheadings
    const subHeadingsRow = mainHeadings.flatMap((main) => main.subHeadings);
    sheetData.push(subHeadingsRow);

    // Add data rows
    data.forEach((row) => {
      const rowData = mainHeadings.flatMap((main) =>
        main.subHeadings.map((sub) => {
          const key = `${main.label.replace(/\s+/g, "_")}_${sub}`;
          return sub.toLowerCase() === "amount" ||
            sub.toLowerCase() === "quantity"
            ? formatAmount(row[key])
            : row[key] || "";
        })
      );
      sheetData.push(rowData);
    });

    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);

    // Apply styles (black background, white text)
    const range = XLSX.utils.decode_range(ws["!ref"]); // Get cell range

    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellMainHeading = XLSX.utils.encode_cell({ r: 0, c: C }); // Main heading row
      const cellSubHeading = XLSX.utils.encode_cell({ r: 1, c: C }); // Subheading row

      if (ws[cellMainHeading]) {
        ws[cellMainHeading].s = {
          fill: { fgColor: { rgb: "000000" } }, // Black background
          font: { color: { rgb: "FFFFFF" }, bold: true }, // White text, bold
          alignment: { horizontal: "center" },
        };
      }

      if (ws[cellSubHeading]) {
        ws[cellSubHeading].s = {
          fill: { fgColor: { rgb: "000000" } }, // Black background
          font: { color: { rgb: "FFFFFF" }, bold: true }, // White text, bold
          alignment: { horizontal: "center" },
        };
      }
    }

    // Write file
    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
      cellStyles: true, // Ensure styles are applied
    });

    const excelBlob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    // Set filename dynamically based on title prop, with a fallback name
    const filename = title
      ? `${title.replace(/\s+/g, "_")}.xlsx`
      : "table_data.xlsx";

    saveAs(excelBlob, filename);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(title, 14, 10);

    const tableHeaders = mainHeadings.flatMap((main) => main.subHeadings);
    const tableData = data.map((row) =>
      mainHeadings.flatMap((main) =>
        main.subHeadings.map((sub) => {
          const key = `${main.label.replace(/\s+/g, "_")}_${sub}`;
          return sub.toLowerCase() === "amount" ||
            sub.toLowerCase() === "quantity"
            ? formatAmount(row[key])
            : row[key] || "";
        })
      )
    );

    doc.autoTable({
      head: [tableHeaders],
      body: tableData,
      startY: 20,
      theme: "grid",
      headStyles: {
        fillColor: [0, 0, 0], // Black background
        textColor: [255, 255, 255], // White text
        fontStyle: "bold", // Bold text for headings
        halign: "center", // Center the header text
      },
    });
    // Set filename dynamically based on title prop, with a fallback name
    const filename = title
      ? `${title.replace(/\s+/g, "_")}.pdf`
      : "table_data.pdf";

    doc.save(filename);
  };

  // Handle dropdown selection
  const handleTypeChange = (event) => {
    setSelectedType(event.target.value);
    setTypeError(""); // Reset error when selection changes
  };

  // Handle export action
  const handleExport = (e) => {
    e.preventDefault();

    if (!selectedType) {
      setTypeError("Type is required.");
      return;
    }

    if (selectedType === "PDF") {
      exportToPDF();
    } else if (selectedType === "EXCEL") {
      exportToExcel();
    }
  };

  const renderDropdown = () => {
    return (
      <div className="relative flex flex-col gap-2 w-1/4 lg:w-60 mb-5">
        <label className="block text-sm font-medium text-gray-700">
          Select File Type
        </label>
        <select
          value={selectedType}
          onChange={handleTypeChange}
          className="w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white text-left overflow-hidden text-ellipsis whitespace-nowrap"
          style={{ minHeight: "40px" }}
        >
          <option value="" disabled>
            Select a Type
          </option>
          {typeOptions.map((name, index) => (
            <option key={index} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div>
      {renderDropdown()}
      {typeError && (
        <p className="text-red-500 text-sm mt-[-5px] mb-4">{typeError}</p>
      )}
      <button
        onClick={handleExport}
        className="bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded-md shadow-md mb-7"
      >
        Export
      </button>
      <div className="overflow-x-auto overflow-y-auto max-h-96 max-w-screen-lg mx-auto rounded-lg border border-gray-400">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
          <thead className="bg-gray-100">
            {/* Main Headings */}
            <tr>
              {mainHeadings.map((main, index) => (
                <th
                  key={index}
                  colSpan={main.subHeadings.length}
                  className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300"
                >
                  {main.label}
                </th>
              ))}
            </tr>
            {/* Subheadings */}
            <tr>
              {mainHeadings.map((main, index) =>
                main.subHeadings.map((sub, subIndex) => (
                  <th
                    key={`${index}-${subIndex}`}
                    className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300"
                  >
                    {sub}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-100">
                {mainHeadings.map((main, index) =>
                  main.subHeadings.map((sub, subIndex) => {
                    // Construct key based on main heading and subheading
                    const dataKey = `${main.label.replace(/\s+/g, "_")}_${sub}`;
                    const cellValue = row[dataKey] || "";

                    return (
                      <td
                        key={`${rowIndex}-${index}-${subIndex}`}
                        className={`px-6 py-3 whitespace-nowrap text-sm text-gray-900 border border-gray-300 ${
                          ["amount", "quantity"].includes(sub.toLowerCase())
                            ? "text-right"
                            : "text-center"
                        }`}
                      >
                        {/* Format Amount values; otherwise, render as-is */}
                        {sub.toLowerCase() === "amount" ||
                        sub.toLowerCase() === "quantity"
                          ? formatAmount(cellValue)
                          : cellValue}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NestedDynamicTable;
