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
      <div className="relative flex flex-col gap-2 w-full md:w-60 mb-5">
       
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
    <div className="space-y-4">
  <div className="flex flex-col sm:flex-row items-center gap-4 mb-10">
    {/* Wrapper for label and dropdown */}
    <div className="w-full sm:w-auto flex flex-col gap-2">
      <label className="block text-sm font-medium text-gray-700 w-full mt-5">
        Select File Type:
      </label>
      <div className="w-full">
        {renderDropdown()}
      </div>
      {typeError && (
        <p className="text-red-500 text-sm mb-4">{typeError}</p>
      )}
    </div>
    <button
      onClick={handleDataSubmit}
      className="bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-2 rounded-md shadow-md w-full sm:w-auto mt-0 md:mt-6 "
    >
      Export
    </button>
  </div>
  <div className="overflow-x-auto my-5 mx-auto rounded-lg border border-gray-400 ">
    <div
      className={`overflow-y-auto ${shouldScroll ? "max-h-64" : ""}`}
      style={shouldScroll ? { maxHeight: "350px" } : {}}
    >
      <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
        <thead className="bg-gray-100 sticky top-0">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300"
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
              className="hover:bg-gray-100 cursor-pointer"
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
