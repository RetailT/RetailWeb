import { FaTrash } from "react-icons/fa";
import { useRef, useEffect } from "react";

const ScrollableTable = ({
  headers,
  data,
  editableColumns,
  onRowChange,
  onDeleteRow,
  formatColumns = [],
  formatColumnsQuantity = [],
  rightAlignedColumns = [],
  bin,
  onRowClick
}) => {
  const shouldScrollVertically = data.length > 7; // Enable vertical scroll if more than 7 rows
  const tableRef = useRef(null);

  // Auto-scroll to the bottom when new rows are added
  useEffect(() => {
    if (shouldScrollVertically && tableRef.current) {
      tableRef.current.scrollTop = tableRef.current.scrollHeight;
    }
  }, [data.length]);

  // Function to get the input type for a specific column
  const getInputType = (columnIndex) => {
    const editableColumn = editableColumns.find(
      (col) => col.index === columnIndex
    );
    return editableColumn ? editableColumn.type : "text"; // Default to 'text' if not defined
  };

  // Function to get the alignment class for a specific column
  const getColumnAlignment = (columnIndex) => {
    return rightAlignedColumns.includes(columnIndex) ? "text-right" : "text-left";
  };

  return (
    <div className="flex flex-col p-4">
      {/* Responsive horizontal scroll */}
      <div className="w-full overflow-x-auto">
        {/* Table container with vertical scroll when needed */}
        <div
          ref={tableRef}
          className={`border border-gray-300 rounded-md ${
            shouldScrollVertically ? "max-h-[400px] overflow-y-auto" : ""
          }`}
        >
          <table className="min-w-[700px] md:min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                {headers.map((header, index) => (
                  <th
                    key={index}
                    className="px-4 py-2 text-xs font-medium tracking-wider text-gray-500 uppercase border border-gray-300"
                  >
                    {header}
                  </th>
                ))}
                {data.length > 0 && !bin && (
                  <th className="px-4 py-2 text-xs font-medium tracking-wider text-center text-gray-500 uppercase border border-gray-300">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-100">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`px-6 py-3 whitespace-nowrap text-sm ${getColumnAlignment(
                        cellIndex
                      )} text-gray-900 border border-gray-300`}
                      onClick={() => onRowClick && onRowClick(row, rowIndex)}
                    >
                      {editableColumns.some(
                        (col) => col.index === cellIndex
                      ) ? (
                        <input
                          type={getInputType(cellIndex)}
                          value={cell || ""}
                          onChange={(e) =>
                            onRowChange(rowIndex, cellIndex, e.target.value)
                          }
                          className="w-full"
                        />
                      ) : (cell !== undefined && cell !== null) ? (
    formatColumnsQuantity.includes(cellIndex)
      ? `${parseFloat(cell).toFixed(3)}`
      : formatColumns.includes(cellIndex)
      ? `${parseFloat(cell).toFixed(2)}`
      : cell
  ) : (
    cell
  )
}
                    </td>
                  ))}
                  {!bin && (
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => onDeleteRow(rowIndex)}
                        className="p-2 text-red-600 hover:text-red-800"
                      >
                        <FaTrash size={16} />
                      </button>
                    </td>
                  )}
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
