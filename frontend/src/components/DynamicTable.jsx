import React, { useState } from "react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const NestedDynamicTable = ({ data, mainHeadings, title, onRowSelect }) => {
  const [selectedType, setSelectedType] = useState("");
  const [typeError, setTypeError] = useState("");
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const typeOptions = ["PDF", "EXCEL"];

  if (!data || data.length === 0) {
    return <p className="text-center">No data available</p>;
  }

  const formatAmount = (value) => {
    if (!value) return "0.00";
    const num = parseFloat(value);
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const exportToExcel = () => {
    const sheetData = [];
    const mainHeadingsRow = mainHeadings.map((main) => main.label);
    sheetData.push(mainHeadingsRow);
    const subHeadingsRow = mainHeadings.flatMap((main) => main.subHeadings);
    sheetData.push(subHeadingsRow);

    data.forEach((row) => {
      const rowData = mainHeadings.flatMap((main) =>
        main.subHeadings.map((sub) => {
          const key = `${main.label.replace(/\s+/g, "_")}_${sub}`;
          return sub.toLowerCase() === "amount" || sub.toLowerCase() === "quantity" || sub.toLowerCase() === "costprice" 
          || sub.toLowerCase() === "unitprice" || sub.toLowerCase() === "scalesvalue"
          || sub.toLowerCase() === "costvalue"
            ? formatAmount(row[key])
            : row[key] || "";
        })
      );
      sheetData.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);

    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
      cellStyles: true,
    });

    const excelBlob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    const filename = title ? `${title.replace(/\s+/g, "_")}.xlsx` : "table_data.xlsx";
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
          return sub.toLowerCase() === "amount" || sub.toLowerCase() === "quantity" || 
          sub.toLowerCase() === "costprice" || sub.toLowerCase() === "unitprice" || sub.toLowerCase() === "scalesvalue"
          || sub.toLowerCase() === "costvalue"
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
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
    });

    const filename = title ? `${title.replace(/\s+/g, "_")}.pdf` : "table_data.pdf";
    doc.save(filename);
  };

  const handleTypeChange = (event) => {
    setSelectedType(event.target.value);
    setTypeError("");
  };

  const handleExport = (e) => {
    e.preventDefault();
    if (!selectedType) {
      setTypeError("Type is required.");
      return;
    }
    selectedType === "PDF" ? exportToPDF() : exportToExcel();
  };

  const handleRowClick = (rowData, rowIndex) => {
    setSelectedRowIndex(rowIndex);
    if (onRowSelect) onRowSelect(rowData);
  };

  const renderDropdown = () => (
    <div className="relative flex flex-col gap-2 w-full md:w-60 lg:w-96 mb-5 pl-0 md:pl-44">
      <label className="block text-sm font-medium text-gray-700 w-full mb-3">
        Select File Type:
      </label>
      <select
        value={selectedType}
        onChange={handleTypeChange}
        className="w-full border border-gray-300 p-2 rounded-md shadow-sm bg-white h-10"
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
      {typeError && (
        <p className="text-red-500 text-sm mt-[-5px] mb-4">{typeError}</p>
      )}
      <button
        onClick={handleExport}
        className="bg-[#f17e21] hover:bg-[#efa05f] text-white px-4 py-1.5 rounded-md shadow-md w-full mt-5 md:mt-3 mb-10 h-10"
      >
        Export
      </button>
    </div>
  );

  return (
    <div>
      {renderDropdown()}
      <div className="overflow-x-auto overflow-y-auto max-h-96 max-w-screen-lg mx-auto rounded-lg border border-gray-400">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
          <thead className="bg-gray-100">
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
              <tr
                key={rowIndex}
                className={`cursor-pointer hover:bg-gray-100 ${
                  selectedRowIndex === rowIndex ? "bg-blue-100" : ""
                }`}
                onClick={() => handleRowClick(row, rowIndex)}
              >
                {mainHeadings.map((main, index) =>
                  main.subHeadings.map((sub, subIndex) => {
                    const dataKey = `${main.label.replace(/\s+/g, "_")}_${sub}`;
                    const cellValue = row[dataKey] || "";
                    return (
                      <td
                        key={`${rowIndex}-${index}-${subIndex}`}
                        className={`px-6 py-3 whitespace-nowrap text-sm text-gray-900 border border-gray-300 ${
                          ["amount", "quantity", "costprice", "unitprice", "salesvalue", "costvalue"].includes(sub.toLowerCase())
                            ? "text-right"
                            : "text-left"
                        }`}
                      >
                        {["amount", "quantity", "costprice", "unitprice", "salesvalue", "costvalue"].includes(sub.toLowerCase())
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