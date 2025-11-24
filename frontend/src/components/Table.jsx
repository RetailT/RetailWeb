import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import "jspdf-autotable";

const ScrollableTable = ({ headers, data, onRowClick, rightAlignedColumns = [] }) => {
  const shouldScroll = data.length > 7; // Check if more than 7 rows
  const [typeError, setTypeError] = useState("");

  const typeOptions = ["PDF", "EXCEL"];
  const [selectedType, setSelectedType] = useState("");

  // Function to export table data to Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
  
    // Define Header Row with Styling
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A1" });
  
    // Apply Styling: Set Black Background & White Text for Headers
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: col }); // First row (header row)
      if (!ws[cellRef]) continue;
  
      ws[cellRef].s = {
        fill: { fgColor: { rgb: "000000" } }, // Black Background
        font: { color: { rgb: "FFFFFF" }, bold: true }, // White Text
        alignment: { horizontal: "center" },
      };
    }
  
    // Add Data Rows
    XLSX.utils.sheet_add_aoa(ws, data, { origin: "A2" });
  
    XLSX.utils.book_append_sheet(wb, ws, "Company Sales Records");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const excelBlob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });
  
    saveAs(excelBlob, "company_sales_data.xlsx");
  };
  

  // Function to export table data to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Company Sales Records", 14, 10);
  
    doc.autoTable({
      head: [headers], // Table headers
      body: data, // Table data
      startY: 20, // Start position after title
      theme: "grid",
      headStyles: {
        fillColor: [0, 0, 0], // Black background
        textColor: [255, 255, 255], // White text
        fontStyle: "bold",
        halign: "center",
      },
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
    });
  
    doc.save("company_sales_data.pdf");
  };
  

  const handleTypeChange = (event) => {
    setSelectedType(event.target.value);
  };
  let valid = true;
  const handleDataSubmit = async (e) => {
    e.preventDefault();

    if (!selectedType) {
      setTypeError("Type is required.");
      valid = false;
    }
    if (selectedType) {
      console.log(selectedType);
      setTypeError("");
      valid = true;
    }
    if (valid) {
      if (selectedType === "PDF") {
        exportToPDF();
      } else if (selectedType === "EXCEL") {
        exportToExcel();
      }
    }
  };
  
  const renderDropdown = () => {
    return (
      <div className="relative flex flex-col w-full gap-2 mb-5 md:w-60">
       
        <select
          value={selectedType}
          onChange={handleTypeChange}
          className="w-full p-2 overflow-hidden text-left bg-white border border-gray-300 rounded-md shadow-sm text-ellipsis whitespace-nowrap"
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
    <div className="space-y-4">
  <div className="flex flex-col items-center gap-4 mb-10 sm:flex-row">
    {/* Wrapper for label and dropdown */}
    <div className="flex flex-col w-full gap-2 sm:w-auto">
      <label className="block w-full mt-5 text-sm font-medium text-gray-700">
        Select File Type:
      </label>
      <div className="w-full">
        {renderDropdown()}
      </div>
      {typeError && (
        <p className="mb-4 text-sm text-red-500">{typeError}</p>
      )}
    </div>
    <button
      onClick={handleDataSubmit}
      className="bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded-md shadow-md w-full sm:w-auto mt-0 md:mt-6 "
    >
      Export
    </button>
  </div>
  <div className="mx-auto my-5 overflow-x-auto border border-gray-400 rounded-lg ">
    <div
      className={`overflow-y-auto ${shouldScroll ? "max-h-64" : ""}`}
      style={shouldScroll ? { maxHeight: "350px" } : {}}
    >
      <table className="min-w-full border border-gray-300 divide-y divide-gray-200">
        <thead className="sticky top-0 bg-gray-100">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-4 py-2 text-xs font-medium tracking-wider text-center text-gray-500 uppercase border border-gray-300"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="cursor-pointer hover:bg-gray-100"
              onClick={() => onRowClick(headers, row)}
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-6 py-3 whitespace-nowrap text-sm border border-gray-300 ${
                    rightAlignedColumns.includes(cellIndex) ? "text-right" : "text-left"
                  }`}
                >
                  {cell || ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
</div>
  );
};

export default ScrollableTable;
