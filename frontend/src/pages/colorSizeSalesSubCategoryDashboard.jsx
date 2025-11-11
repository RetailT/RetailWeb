import { useEffect, useState, useContext} from "react";
import Navbar from "../components/NavBar";
import Heading from "../components/Heading";
import DatePicker from "../components/DatePicker";
import MultiSelectDropdown from "../components/MultiSelectDropdown";
import Table from "../components/EditableTable";
import Alert from "../components/Alert";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../AuthContext";
import CircleBounceLoader from "../components/Loader";
import axios from "axios";
import NestedDynamicTable from "../components/DynamicTable";
// import BarChart from "../components/BarChart";

const SubCategoryDashboard = () => {
  const { authToken } = useContext(AuthContext);
  const [userData, setUserData] = useState(null);
  // const [amountBarChartRecords, setAmountBarChartRecords] = useState([]);
  // const [quantityBarChartRecords, setQuantityBarChartRecords] = useState([]);
  // const [amountBarChartLabels, setAmountBarChartLabels] = useState([]);
  // const [quantityBarChartLabels, setQuantityBarChartLabels] = useState([]);
  const [departmentName, setDepartmentName] = useState("");
    const [newTableHeaders, setNewTableHeaders] = useState([]);
    const [newTableData, setNewTableData] = useState([]);
  const [disable, setDisable] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDates, setSelectedDates] = useState({});
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [firstOption, setFirstOption] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [isChecked, setIsChecked] = useState(true);
  const now = new Date();
  const [alert, setAlert] = useState(null);
  const [tableRecords, setTableRecords] = useState(null);
  const [tableHeadings, setTableHeadings] = useState(null);

  const token = localStorage.getItem("authToken");


  const formatDate = (date) => {
    const localDate = new Date(date);
    localDate.setHours(0, 0, 0, 0);
    const year = localDate.getFullYear();
    const month = (localDate.getMonth() + 1).toString().padStart(2, "0"); // Months are 0-based
    const day = localDate.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formattedDate = formatDate(now);

  let newFromDate;
  let newToDate;
  const displayFromDate = selectedDates.fromDate
    ? formatDate(selectedDates.fromDate)
    : null;
  const displayToDate = selectedDates.toDate
    ? formatDate(selectedDates.toDate)
    : null;

  if (displayFromDate && displayToDate && displayFromDate > displayToDate) {
    newFromDate = displayToDate;
    newToDate = displayFromDate;
  } else {
    newFromDate = displayFromDate;
    newToDate = displayToDate;
  }

  const displayDate =
    submitted && selectedDates.fromDate && selectedDates.toDate
      ? `Date: ${newFromDate} - ${newToDate}`
      : submitted && selectedDates.fromDate
        ? `Date: ${formatDate(selectedDates.fromDate)}`
        : submitted && selectedDates.toDate
          ? `Date: ${formatDate(selectedDates.toDate)}`
          : `Date: ${formattedDate}`;

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}companies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUserData(response.data.userData);

      if (response.data.userData && response.data.userData.length > 0) {
        // Map through all userData and get all options
        const allOptions = response.data.userData.map((data) => ({
          code: data.COMPANY_CODE.trim(),
          name: data.COMPANY_NAME.trim(),
        }));

        // Set the first option to include all options
        setFirstOption(allOptions);
        setSelectedOptions(allOptions); // Set the selected options to all options as well
      }
      else{
         setDisable(false);
        setAlert({ message: response.data.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      }
    } catch (err) {
      setError("Failed to fetch dashboard data");
setDisable(false);
        setAlert({ message: err.response?.data?.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      console.error("Error fetching dashboard data:", err);
    }
  };

  const fetchData = async () => {
     setNewTableData([]);
    setNewTableHeaders([]);
    setDepartmentName("");
    if (firstOption) {
      setDisable(true);
      const token = localStorage.getItem("authToken");
      try {
        const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}sub-category-data`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            currentDate: formattedDate,
            fromDate: newFromDate,
            toDate: newToDate,
            selectedOptions: selectedOptions.map((option) => option.code).join(","),
          },
        });

        if(response.data.message==='Processed parameters for company codes'){
// const amountBarChartData = response.data.subCategoryAmountBarChart;
//         const quantityBarChartData = response.data.subCategoryQuantityBarChart;
        const tableData = response.data.subCategoryTableRecords;


        // const amountLabels = amountBarChartData.map(
        //   (item) => item.SCATNAME
        // );
        // setAmountBarChartLabels(amountLabels);

        // const amountData = amountBarChartData.map(
        //   (item) => item.AMOUNT
        // );
        // setAmountBarChartRecords(amountData);

        // const quantityLabels = quantityBarChartData.map(
        //   (item) => item.SCATNAME
        // );
        // setQuantityBarChartLabels(quantityLabels);

        // const quantityData = quantityBarChartData.map(
        //   (item) => item.QUANTITY
        // );
        // setQuantityBarChartRecords(quantityData);

        const updatedTableData = tableData.map((item) => {
          const matchingOption = firstOption.find(
            (option) => option.code === item.COMPANY_CODE
          );
          const companyName = matchingOption ? matchingOption.name : "UNKNOWN"; // Company name or 'UNKNOWN'

          return {
            SUBCATEGORY_NAME: item.SUBCATEGORY_NAME,
            SUBCATEGORY_CODE: item.SUBCATEGORY_CODE,
            COMPANY_NAME: companyName, // Company name
            [`${companyName}_QUANTITY`]: item.QUANTITY, // Dynamic key with company name
            [`${companyName}_AMOUNT`]: item.AMOUNT, // Dynamic key with company name
          };
        });

        const namesArray = firstOption.map((option) => option.name);
        const filteredNames = namesArray.filter((name) =>
          updatedTableData.some((record) => record.COMPANY_NAME === name)
        );
        const mainHeadings = [
          { label: "SUBCATEGORY", subHeadings: ["CODE", "NAME"] },
          ...filteredNames.map((name) => ({
            // Replace spaces with underscores
            label: name.replace(/\s+/g, "_"),
            subHeadings: ["AMOUNT", "QUANTITY"],
          })),
        ];

        setTableHeadings(mainHeadings);

        const transformedData = updatedTableData.map((row) => {
          const newRow = {};
          for (let key in row) {
            // Replace spaces with underscores in the keys
            const normalizedKey = key.replace(/\s+/g, "_");
            newRow[normalizedKey] = row[key];
          }
          filteredNames.forEach((name) => {
            const formattedName = name.replace(/\s+/g, "_");

            if (!newRow.hasOwnProperty(`${formattedName}_AMOUNT`)) {
              newRow[`${formattedName}_AMOUNT`] = "";
            }
            if (!newRow.hasOwnProperty(`${formattedName}_QUANTITY`)) {
              newRow[`${formattedName}_QUANTITY`] = "";
            }
          });
          return newRow;
        });

        function aggregateData(data) {
          const aggregatedData = {};

          data.forEach((record) => {
            const { SUBCATEGORY_NAME, SUBCATEGORY_CODE, ...rest } = record;

            if (!aggregatedData[SUBCATEGORY_NAME]) {
              aggregatedData[SUBCATEGORY_NAME] = {
                SUBCATEGORY_NAME,
                SUBCATEGORY_CODE,
              };
            }

            Object.keys(rest).forEach((key) => {
              const value = rest[key];
              if (!aggregatedData[SUBCATEGORY_NAME][key] && value !== "") {
                aggregatedData[SUBCATEGORY_NAME][key] = parseFloat(value); // Convert to number
              } else if (value !== "") {
                aggregatedData[SUBCATEGORY_NAME][key] += parseFloat(value);
              }
            });
          });

          return Object.values(aggregatedData);
        }

        // Aggregating the sample data
        const aggregatedResults = aggregateData(transformedData);

        setTableRecords(aggregatedResults);
        setDisable(false);
        }
        else{
          setTableRecords([]);
          setTableHeadings([]);
          setDisable(false);
        setAlert({ message: response.data.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
        }
        
      } catch (err) {
        console.error("Error sending parameters:", err);
        setDisable(false);
        setAlert({ message: err.response?.data?.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
      }
    }
  };

  const fetchSubCategoryData = async (row) => {
    setNewTableData([]);
    setNewTableHeaders([]);
    setDepartmentName("");

      if (firstOption) {
        setDisable(true);
        const token = localStorage.getItem("authToken");
        try {
          const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}color-size-sales-subcategory-data`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            params: {
              code : row.SUBCATEGORY_CODE,
              selectedOptions: selectedOptions.map((option) => option.code).join(","),
            },
          });
  

          if (response.data.message==='Processed parameters for company codes'){
const tableData = response.data.records;
setDepartmentName(row.SUBCATEGORY_NAME);
        
          const customDepartmentHeaders = ["PRODUCT_CODE", "PRODUCT_NAME", "SERIALNO",  "COSTPRICE", "UNITPRICE", "DISCOUNT", "AMOUNT" ];

        const customDepartmentHeaderMapping = {
            PRODUCT_CODE: "Product Code",
          PRODUCT_NAME: "product Name",
            SERIALNO: "SERIAL NO",
          COSTPRICE: "COST PRICE",
          UNITPRICE: "UNIT PRICE",
          DISCOUNT: "DISCOUNT",
          AMOUNT: "AMOUNT"
        };
          const customHeaders = customDepartmentHeaders.map(
            (key) => customDepartmentHeaderMapping[key] || key
          );
          setNewTableHeaders(customHeaders);
  
          const formattedTableData = tableData.map((item) =>
          customDepartmentHeaders.map((key) => item[key])
          );
          setNewTableData(formattedTableData);
  
  
          setDisable(false);
          }
          else{
setDisable(false);
        setAlert({ message: response.data.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
          }
          
          
        } catch (err) {
          console.error("Error sending parameters:", err);
          setDisable(false);
        setAlert({ message: err.response?.data?.message || "Error Occured", type: "error" });
      setTimeout(() => setAlert(null), 3000);
        }
      }
    };

  useEffect(() => {
    if (!token) {
      console.error("No token found in localStorage");
      setError("No token found");

      return;
    }
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchData();
    if (isChecked) {
      // Log the message every 3 seconds when the checkbox is checked
      const intervalId = setInterval(() => {
        window.location.reload();
      }, 180000);

      // Cleanup the interval when the checkbox is unchecked or the component unmounts
      return () => clearInterval(intervalId);
    } else {
      console.log("Checkbox is unchecked.");
    }
  }, [firstOption, isChecked]);

  if (!authToken) {
    return <Navigate to="/login" replace />;
  }

  const handleDateChange = (dates) => {
    setSelectedDates(dates);
  };

  const handleDropdownChange = (options) => {
    setSelectedOptions(options);
  };

  const handleCheckboxChange = () => {
    setIsChecked((prevState) => !prevState); // Toggle the checkbox state
  };

  const handleSubmit = async () => {
  
    if (newToDate === null && newFromDate === null) {
      setAlert({
        message: "Please select the from date and to date",
        type: "error",
      });
      setTimeout(() => setAlert(null), 3000);
    } else if (newFromDate === null) {
      setAlert({ message: "Please select the from date", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    } else if (newToDate === null) {
      setAlert({ message: "Please select the to date", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    }
    else if (selectedOptions.length === 0) {
      setAlert({ message: "Please select a company", type: "error" });
      setTimeout(() => setAlert(null), 3000);
    }

    if (newFromDate !== null && newToDate !== null && selectedOptions.length > 0) {
      setSubmitted(true);
      fetchData();
    }
  };

  const handleRefresh = async () => {
    window.location.reload();
  };

  const companyOptions = userData
    ? userData.map((item) => ({
      code: item.COMPANY_CODE.trim(),
      name: item.COMPANY_NAME.trim(),
    }))
    : [];

  return (
    <div>
      {disable && (
    <CircleBounceLoader />
  )}
      <Navbar />

      {/* Main Layout */}
      
        <div className="container p-6 mx-auto md:p-16">
          <div className="mt-20 md:mt-14">
            <Heading text="Sub Category Sales Dashboard" />
          </div>
          <div className="mt-4">
            {alert && (
              <Alert
                message={alert.message}
                type={alert.type}
                onClose={() => setAlert(null)}
              />
            )}
            <div
          className="p-4 mt-4 bg-gray-200 rounded-lg shadow-md" style={{ backgroundColor: "#d8d8d8" }}
        >
              {isChecked ? (
                    <div className="mt-8">
  {/* First Row - Centered Title */}
  <div className="mb-4 text-xl font-bold text-center sm:text-2xl">
    Current Sub Category Sales
  </div>

  {/* Second Row - Checkbox on Left, Button on Right */}
  <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
    <div className="flex items-center">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleCheckboxChange}
        id="checkbox"
        className="w-3 h-3 mt-4 text-blue-600 focus:ring-blue-500 md:mt-0"
      />
      <label htmlFor="checkbox" className="mt-4 ml-2 font-semibold text-md md:mt-0">
        Current Sales
      </label>
    </div>
    <button
      onClick={handleRefresh}
      disabled={disable}
      className={`px-4 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition duration-200 mt-4 md:mt-0 ${
        disable ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      Refresh
    </button>
  </div>
</div>
              ) : (
                <div className="mt-10">
                              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                <div className="flex flex-col w-full gap-4 sm:flex-row sm:w-auto">
                                  <DatePicker
                                    label="Select Date Range:"
                                    onDateChange={handleDateChange}
                                  />
                                  <label className="block text-sm font-medium text-gray-700 mb-[-10px] md:mb-0 ml-0 md:ml-10">Select Company:</label>
                                  
                                  <div className="w-full sm:w-auto flex flex-col justify-center items-center mt-0 md:mt-5 ml-0 md:ml-[-120px]">
                              <MultiSelectDropdown
                                // label="Select Company:"
                                options={companyOptions}
                                onDropdownChange={handleDropdownChange}
                                selected={selectedOptions}
                              />
                            </div>
                                </div>
                                <div className="flex flex-col justify-center gap-4 mt-3 sm:flex-row sm:justify-end md:mt-6">
                                  <button
                                    onClick={handleSubmit}
                                    disabled={disable}
                                    className={`px-4 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition duration-200 ${
                                      disable ? "opacity-50 cursor-not-allowed" : ""
                                    } w-full sm:w-auto`}
                                  >
                                    Submit
                                  </button>
                                  <button
                                    onClick={handleRefresh}
                                    disabled={disable}
                                    className={`px-4 py-2 bg-black text-white rounded-md shadow-md hover:bg-gray-800 transition duration-200 ${
                                      disable ? "opacity-50 cursor-not-allowed" : ""
                                    } w-full sm:w-auto mt-2 sm:mt-0`}
                                  >
                                    Refresh
                                  </button>
                                </div>
                              </div>
                            </div>
              )}
            </div>

            {!isChecked && (
             <div
            className="p-4 mt-3 mb-5 bg-white rounded-md shadow-md sm:p-5"
            style={{ backgroundColor: "#d8d8d8" }}
          >
            <div className="flex justify-center text-xl font-bold text-black sm:text-2xl">
              Sub Category Sales Summary
            </div>

            <div className="flex justify-center mt-4 font-bold">
              <p>{displayDate}</p>
            </div>
          </div>
            )}

            {(submitted || isChecked) && (
              <div className="flex flex-col w-full mt-10 space-y-5">
              <div className="overflow-x-auto">
                <div className="bg-white p-4 border border-gray-300 rounded-md border border-gray-300 min-w-[300px]">
                  <NestedDynamicTable
                    data={tableRecords}
                    mainHeadings={tableHeadings}
                    title="Sub Category Sales Data"
                    onRowSelect={(row) => fetchSubCategoryData(row)}
                  />
                                          <div>
                            {Array.isArray(newTableData) && newTableData.length > 0 && (
                              <div>
                                <p className="text-center text-[#bc4a17] text-lg sm:text-xl font-bold mt-10">
                            {departmentName ? `${departmentName}` : ""}
                          </p>
          <div className="mt-5 overflow-x-auto">
            
            <div className="mx-auto w-max"> 
              <Table
                headers={newTableHeaders}
                data={newTableData}
                formatColumns={[3, 4, 5, 6]}
                editableColumns={[]}
                rightAlignedColumns={[3, 4, 5, 6,7,8]}
                bin={true}
              />
            </div>
          </div>
          </div>
        )}
                          </div>

                </div>
              </div>

            
          </div>
            )}
          </div>
        </div>
      </div>
    
  );
};

export default SubCategoryDashboard;
