import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import * as XLSX from 'xlsx'
import Select from 'react-select';
import { saveAs } from 'file-saver';
import { Plus, X } from 'lucide-react';
import { IconButton, Tooltip, Input } from '@material-tailwind/react';

const expectedHeaders = ['REF', 'DETAIL', 'QTY', 'RATE', 'TOTAL'];


function App() {
  const [selectedOption, setSelectedOption] = useState();
  const [selectedColorOption, setSelectedColorOption] = useState();
  const [colorOptions, setColorOptions] = useState([]);
  const [options, setOptions] = useState([]);
  const [qty, setQty] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);
  console.log(selectedRows);

  const [result, setResult] = useState([
    {
      selectedOption: null,
      selectedColorOption: null,
      qty: '',
      colorOptions: [],
    }
  ]);


  // const excelData = [];
  const [excelData, setExcelData] = useState([]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const binaryStr = evt.target.result;
      const workbook = XLSX.read(binaryStr, { type: 'binary' });

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const sheetArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Find header row index by checking for overlap with expectedHeaders
      const headerRowIndex = sheetArray.findIndex(row =>
        row?.some(cell => expectedHeaders.includes(String(cell).trim().toUpperCase()))
      );

      if (headerRowIndex === -1) {
        alert('Header row not found.');
        return;
      }

      const headers = sheetArray[headerRowIndex];
      const dataRows = sheetArray.slice(headerRowIndex + 1);

      const formattedData = dataRows.map(row =>
        headers.reduce((obj, key, i) => {
          obj[key?.toString().trim() || `Column_${i}`] = row[i] ?? null;
          return obj;
        }, {})
      );

      const uniqData = formattedData
        // 1. Extract and clean "REF STICKERS"
        .map(x => x['REF STICKERS']?.toString().trim())
        .filter(Boolean)
        .filter((ref, index, self) => self.indexOf(ref) === index)
        .reduce((acc, ref) => {
          const baseRef = ref.split(/[\s\-_]/)[0];
          const existingGroup = acc.find(item => item.baseRef === baseRef);

          if (existingGroup) {
            // Append to existing group
            existingGroup.refs.push(ref);
            existingGroup.label = `${existingGroup.refs}`;
            existingGroup.value = existingGroup.refs.join(',');
          } else {
            // Create new group
            acc.push({
              baseRef,
              label: baseRef,
              value: ref,
              refs: [ref],
            });
          }
          return acc;
        }, []);
      setOptions(uniqData);
      setExcelData(formattedData);
    };

    reader.readAsBinaryString(file);
  };

  // console.log(excelData)
  const onSubmit = () => {
    if (excelData?.length === 0) {
      alert('No data to submit');
      return;
    }
  }

  const filteredColorData = () => {
    console.log('called')
    const color = options?.filter(x => x[selectedOption?.baseRef]);
    console.log(options, color)
    setColorOptions({ label: 'hh', value: 'as' });
    // setSelectedColorOption()
  }


  const addRow = (e, index) => {
    const updated = [...result];
    const selectedRefs = updated[index]?.selectedOption?.refs || [];
    const selectedColor = updated[index]?.selectedColorOption?.value;
    const QTY = updated[index]?.qty;

    updated[index]['excelRow']?.map((x, i) =>
      updated[index]['excelRow'][i]['Total'] =
      ((updated[index]['excelRow'][i]['PRICE'] * updated[index]['excelRow'][i]['SFT']) + (updated[index]['excelRow'][i]['DRILL_PRICE'] || 0) * QTY).toFixed(2)
    )
    setResult(updated);
    console.log(selectedColor, updated[index]?.selectedColorOption?.value);

    // Find matching rows from Excel
    const matchingRows = excelData.filter(rowData =>
      selectedRefs.includes(rowData['REF STICKERS']?.toString().trim().toUpperCase()) &&
      rowData['COLOUR']?.toString().trim().toUpperCase() === selectedColor.toUpperCase()
    );

    // Add qty to each matched row
    const newRows = matchingRows.map(row => ({
      ...row,
      QTY,
    }));

    // Append to result
    setResult(prev => [...prev, newRows]);
    setSelectedRows(prev => [...prev, ...newRows])
  };

  const handleDeleteRow = (indexToDelete) => {
    const updatedResult = [...result];
    const removedRow = updatedResult.splice(indexToDelete, 1)[0]; // remove and capture the deleted row

    setResult(updatedResult);

    // Optional: If you want to remove associated rows from selectedRows as well:
    if (removedRow?.excelRow?.length) {
      setSelectedRows(prev => prev.filter(row =>
        !removedRow.excelRow.some(deleted =>
          JSON.stringify(deleted) === JSON.stringify(row)
        )
      ));
    }
  };



  const exportSelectedRowsToExcel = () => {
    const flatData = selectedRows.flat();

    if (flatData.length === 0) {
      alert("No data to export.");
      return;
    }

    // Step 1: Heading row
    const heading = [["Selected Tile Orders"]];

    // Step 2: Create worksheet with heading
    const worksheet = XLSX.utils.aoa_to_sheet(heading);

    // Step 3: Add data below heading
    XLSX.utils.sheet_add_json(worksheet, flatData, {
      origin: 'A2',
      skipHeader: false,
    });

    // Step 3.5: Adjust column widths to fit content
    worksheet['!cols'] = getColWidths(flatData);

    // Step 4: Merge heading across columns (e.g., from A1 to E1)
    const columnCount = Object.keys(flatData[0]).length;
    const lastColumnLetter = XLSX.utils.encode_col(columnCount - 1); // e.g., E
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } } // merge A1:E1
    ];

    // Step 5: Optional - style the heading
    worksheet['A1'].s = {
      font: { bold: true, sz: 14 },
      alignment: { horizontal: "center", vertical: "center" }
    };

    // Step 6: Create workbook and export
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SelectedRows");

    // Add styles (required for styling to work in some viewers)
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
      cellStyles: true,
    });

    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "SelectedRows.xlsx");
  };

  const getColWidths = (data) => {
    const keys = Object.keys(data[0]);
    return keys.map(key => {
      const maxLen = Math.max(
        key.length,
        ...data.map(row => (row[key] ? row[key].toString().length : 0))
      );
      return { wch: maxLen + 5 }; // +5 for padding
    });
  };

  console.log(selectedRows)

  return (
    <div>
      <div className='flex gap-4 justify-center items-center w-full h-full p-10'>
        <input type="file" onChange={(e) => handleFileChange(e)} accept=".xlsx, .xls" className='border border-green-200 p-3' />
        <button onClick={onSubmit} disabled={!excelData} className='bg-green-500 rounded-md px-3 py-2.5 text-white'>Submit</button>
      </div>
      <div className='flex justify-end'>
        <button className='bg-green-500 px-3 py-2.5 rounded-md mr-3 text-white text-xs' onClick={exportSelectedRowsToExcel}>Export</button>
      </div>

      <div className='w-full p-4 '>
        <table className='w-full'>
          <thead className='bg-gray-100'>
            <tr>
              <th className='px-3 py-2 uppercase'>S.No</th>
              <th className='px-3 py-2 uppercase'>Ref Stickers</th>
              <th className='px-3 py-2 uppercase'>Colours</th>
              <th className='px-3 py-2 uppercase'>Total Quantity</th>
              <th className='px-3 py-2 uppercase'>Rate</th>
              <th className='px-3 py-2 uppercase'>Drill Price (pcs)</th>
              <th className='px-3 py-2 uppercase'>Action</th>
            </tr>
          </thead>
          <tbody>
            {result.map((row, index) => (
              <tr key={index} className='text-left'>
                <td className='px-3 py-3'>{index + 1}</td>
                <td className='px-3 py-3'>
                  <Select
                    options={options}
                    value={row.selectedOption}
                    onChange={(e) => {
                      const updated = [...result];
                      updated[index].selectedOption = e;

                      const color = excelData?.map(x => x['REF STICKERS'] == e?.baseRef && {
                        label: x?.['COLOUR'], value: x?.['COLOUR'], qty: x?.['QTY']
                      }).filter(x => x !== false);

                      updated[index].colorOptions = color;
                      updated[index].selectedColorOption = null;
                      updated[index].qty = null;

                      setResult(updated);
                    }}
                    placeholder="Select"
                  />
                </td>
                <td className='px-3 py-3'>
                  <Select
                    options={row.colorOptions}
                    value={row.selectedColorOption}
                    onChange={(e) => {
                      const updated = [...result];
                      updated[index].selectedColorOption = e;
                      updated[index].qty = e?.qty;

                      // Save the full matching row from excelData
                      const matchingRows = excelData.filter(rowData =>
                        updated[index].selectedOption?.refs?.includes(
                          rowData['REF STICKERS']?.toString().trim().toUpperCase()
                        ) &&
                        rowData['COLOUR']?.toString().trim().toUpperCase() === e?.value.toUpperCase()
                      );
                      updated[index].excelRow = matchingRows || null;
                      setResult(updated);
                    }}
                    placeholder="Select Color"
                  />

                </td>
                <td className='px-3 py-3'>
                  <div className='w-52'>
                    <input
                      type='number'
                      value={row.qty || ''}
                      className='w-full p-2 border border-gray-400 rounded-md'
                      onChange={(e) => {
                        const updated = [...result];
                        updated[index].qty = e.target.value;
                        setResult(updated);
                      }}
                    />
                    {row.qty && (
                      <p>Total Pcs: <strong>{row.qty}</strong></p>
                    )}
                  </div>
                </td>
                {/* price dimension */}
                <td className='px-3 py-3'>
                  <div className='flex gap-2'>
                    <div class="relative">
                      <input type="number" id="floating_outlined"
                        class="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                        placeholder=" "
                        onChange={(e) => {
                          const updated = [...result];
                          if (updated[index]['excelRow'][0]) {
                            updated[index]['excelRow'][0]['PRICE'] = e.target.value;

                            // SFT calculation
                            const dimensionString = row?.excelRow?.[0]['DIMENSIONS'];
                            const qty = updated[index].qty;
                            const [length, breadth] = dimensionString
                              .toLowerCase()
                              .replace(/\s/g, "")
                              .split("x")
                              .map(Number);
                            updated[index]['excelRow'][0]['SFT'] = isNaN(length) || isNaN(breadth) ? 0 : (((length * breadth) / 930) * qty).toFixed(3);
                            setResult(updated);
                          }
                        }}
                      />
                      <label for="floating_outlined" class="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">
                        {row?.excelRow?.[0] && row?.excelRow?.[0]['DIMENSIONS'] || 'N/A'}
                      </label>
                    </div>
                    <div class="relative">
                      <input type="number" id="floating_outlined"
                        class="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                        placeholder=" "
                        onChange={(e) => {
                          const updated = [...result];
                          if (updated[index]['excelRow'][1]) {
                            updated[index]['excelRow'][1]['PRICE'] = e.target.value;

                            // SFT calculation
                            const dimensionString = row?.excelRow?.[1]['DIMENSIONS'];
                            const qty = updated[index].qty;
                            const [length, breadth] = dimensionString
                              .toLowerCase()
                              .replace(/\s/g, "")
                              .split("x")
                              .map(Number);
                            updated[index]['excelRow'][1]['SFT'] = (isNaN(length) || isNaN(breadth) ? 0 : ((length * breadth) / 930) * qty).toFixed(3);
                            setResult(updated);
                          }
                        }}
                      />
                      <label for="floating_outlined" class="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">
                        {row?.excelRow?.[1] && row?.excelRow?.[1]['DIMENSIONS'] || 'N/A'}
                      </label>
                    </div>

                  </div>
                </td>
                {/* drill */}
                <td className='px-3 py-3'>
                  <div className='flex gap-2'>
                    <div class="relative">
                      <input type="text" id="floating_outlined"
                        class="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                        placeholder={`${row?.selectedOption?.refs?.[0] || 'N/A'}`} disabled={row?.excelRow?.[0] && row?.excelRow?.[0]['DRILL'] == 'NO DRILL'}
                        onChange={(e) => {
                          const updated = [...result];
                          if (updated[index]['excelRow'][0] && updated[index]['excelRow'][0]['DRILL']) {
                            const price = e.target.value * updated[index]['excelRow'][0]['DRILL']
                            updated[index]['excelRow'][0]['DRILL_PRICE'] = price;
                            setResult(updated);
                          } else {
                            alert('Enter price first or excel data mismatch');
                            console.error('Enter price first or excel data mismatch')
                          }
                        }}
                      />
                      <label for="floating_outlined" class="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">
                        {`No.of Drill ${row?.excelRow?.[0] && row?.excelRow?.[0]['DRILL'] || 'N/A'}` || 'N/A'}
                      </label>
                    </div>
                    <div class="relative">
                      <input type="text" id="floating_outlined"
                        class="block px-2.5 pb-2.5 pt-4 w-full text-sm text-gray-900 bg-transparent rounded-lg border-1 border-gray-300 appearance-none dark:text-white dark:border-gray-600 dark:focus:border-blue-500 focus:outline-none focus:ring-0 focus:border-blue-600 peer"
                        placeholder={`${row?.selectedOption?.refs?.[1] || 'N/A'}`}
                        disabled={row?.excelRow?.[1] && row?.excelRow?.[1]['DRILL'] == 'NO DRILL'}
                        onChange={(e) => {
                          const updated = [...result];
                          if (updated[index]['excelRow'][1] && updated[index]['excelRow'][1]['DRILL']) {
                            const price = e.target.value * updated[index]['excelRow'][1]['DRILL']
                            updated[index]['excelRow'][1]['DRILL_PRICE'] = price;
                            setResult(updated);
                          } else {
                            alert('Enter price first or excel data mismatch');
                            console.error('Enter price first or excel data mismatch')
                          }
                        }}
                      />
                      <label for="floating_outlined" class="absolute text-sm text-gray-500 dark:text-gray-400 duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-white dark:bg-gray-900 px-2 peer-focus:px-2 peer-focus:text-blue-600 peer-focus:dark:text-blue-500 peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto start-1">
                        {` No.of.Drill ${row?.excelRow?.[1] && row?.excelRow?.[1]['DRILL'] || 'N/A'}` || 'N/A'}
                      </label>
                    </div>
                  </div>
                </td>
                <td className='px-3 py-3'>
                  <div className='flex gap-2 p-2  justify-center'>
                    {index != 0 && (
                      <div>
                        <IconButton variant='text' color='red' className='hover:bg-gray-300 p-2'
                          size='sm' onClick={() => {
                            handleDeleteRow(index);
                          }}>
                          <X size={18} className="text-red-700 dark:text-red-400" />
                        </IconButton>
                      </div>
                    )}
                    {index == result.length - 1 && (
                      <div>
                        <IconButton variant='text' color='red' className='hover:bg-gray-300 p-2'
                          size='sm' onClick={(e) => addRow(e, index)}>
                          <Plus size={18} />
                        </IconButton>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </div>
  )
}



export default App
