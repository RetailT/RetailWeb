// import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

const ClusteredBarChart = ({ groupedData }) => {
  // 🧠 Convert grouped object to chart-friendly array
  const chartData = Object.entries(groupedData).map(([period, records]) => {
    const row = { period };
    records.forEach((r) => {
      row[r.COMPANY_NAME] = r.NETSALES; // dynamic company column
    });
    return row;
  });

  // 🏷️ Unique company names for dynamic bars
  const allCompanies = [
    ...new Set(
      Object.values(groupedData)
        .flat()
        .map((item) => item.COMPANY_NAME)
    ),
  ];

  const colors = [
  "#92400e", // brownish orange
  "#ea580c", // deep orange
  "#0a0a0a", // soft black
  "#ff9800", // vivid orange
  "#5c2e05", // deeper brown
  "#ffb347", // light orange
  "#3d1f00", // near black-orange
  "#f97316", // orange (Tailwind orange-500)
  "#1f1300", // very dark brown
  "#c2410c", // burnt orange
  "#78350f", // dark brown
  "#b45309", // dark amber
  "#111111", // matte black
];


  // 💡 Chart width expands with data length
  const chartWidth = Math.max(chartData.length * 150, window.innerWidth);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-full" style={{ width: chartWidth }}>
        <BarChart
          width={chartWidth}
          height={400}
          data={chartData}
          margin={{ top: 20, right: 30, left: 10, bottom: 50 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" angle={-20} textAnchor="end" height={60} />
          <YAxis />
          <Tooltip formatter={(value) => value.toLocaleString()} />
          <Legend/>
          
          {allCompanies.map((company, index) => (
            <Bar
              key={company}
              dataKey={company}
              name={company}
              fill={colors[index % colors.length]}
              barSize={35}
            />
          ))}
        </BarChart>
      </div>
    </div>
  );
};

export default ClusteredBarChart;
