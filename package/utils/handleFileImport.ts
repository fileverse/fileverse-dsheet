// import ExcelJS from 'exceljs';
// // @ts-ignore
// import LuckyExcel from 'luckyexcel';
// import { Sheet } from '@fortune-sheet/core';
// import { Buffer } from 'buffer';

// export const handleFileUploadUtil = async (
//   event: React.ChangeEvent<HTMLInputElement>,
// ): Promise<any> => {
//   const input = event.target;
//   if (!input.files?.length) {
//     return;
//   }
//   const file = input.files[0];
//   let dropdownInfo: {
//     [key: string]: { type: string; formulae: string[] };
//   } | null = null;

//   const reader = new FileReader();
//   reader.onload = async (e) => {
//     if (!e.target) {
//       console.error('FileReader event target is null.');
//       return;
//     }
//     const arrayBuffer = e.target.result;
//     const workbook = new ExcelJS.Workbook();
//     try {
//       if (arrayBuffer === null && Array.isArray(arrayBuffer)) {
//         return;
//       }
//       if (arrayBuffer instanceof ArrayBuffer) {
//         const buffer = Buffer.from(arrayBuffer);
//         await workbook.xlsx.load(buffer);
//       } else {
//         throw new Error('Invalid file format. Expected an ArrayBuffer.');
//       }
//       const worksheet = workbook.getWorksheet(1);
//       if (worksheet) {
//         dropdownInfo = {};
//         worksheet.eachRow((row, rowIndex) => {
//           row.eachCell((cell, colIndex) => {
//             const dataValidation = cell.dataValidation;
//             if (
//               dataValidation &&
//               dataValidation.type === 'list' &&
//               dataValidation.formulae
//             ) {
//               const key = `${String.fromCharCode(65 + colIndex - 1)}${rowIndex}`;
//               if (dropdownInfo) {
//                 dropdownInfo[key] = {
//                   type: dataValidation.type,
//                   formulae: dataValidation.formulae,
//                 };
//               }
//             }
//           });
//         });
//       } else {
//         console.error('Worksheet is undefined.');
//         return;
//       }
//       LuckyExcel.transformExcelToLucky(
//         file,
//         function (exportJson: { sheets: Sheet[] }) {
//           const sheets = exportJson.sheets;
//           for (const sheet of sheets) {
//             if (dropdownInfo && Object.keys(dropdownInfo).length > 0) {
//               const dataVerification: { [key: string]: any } = {};
//               for (const key of Object.keys(dropdownInfo)) {
//                 const value = dropdownInfo[key];
//                 if (value.type === 'list') {
//                   const splited = key.split('');
//                   const col_ = splited[0].charCodeAt(0) - 65;
//                   const row_ = Number(splited[1]) - 1;
//                   const f_key = `${row_}_${col_}`;
//                   dataVerification[f_key] = {
//                     type: 'dropdown',
//                     type2: '',
//                     rangeTxt: key,
//                     value1: value.formulae[0].replace(/["']/g, ''),
//                     value2: '',
//                     validity: '',
//                     remote: false,
//                     prohibitInput: true,
//                     hintShow: false,
//                     hintValue: '',
//                     checked: false,
//                   };
//                 }
//               }
//               sheet.dataVerification = dataVerification;
//             }
//           }
//           //console.log(sheets, '============')
//           //setSheetData(sheets);
//           return sheets;
//         },
//       );
//     } catch (error) {
//       console.error('Error loading the workbook', error);
//       alert(
//         'Error loading the workbook. Please ensure it is a valid .xlsx file.',
//       );
//     }
//   };

//   reader.readAsArrayBuffer(file);
// };

// // useEffect(() => {
// //     if (ref && ref.current) {
// //         console.log(ref.current.getAllSheets());
// //         if (sheetData.length > 0) {
// //             setMergeInfo(sheetData[0].config.merge);
// //         }
// //     }
// // }, [sheetData]);

// // useEffect(() => {
// //     if (mergeInfo) {
// //         Object.keys(mergeInfo).forEach(key => {
// //             const merge = mergeInfo[key]
// //             const startCellAddressR = merge.r
// //             const startCellAddressC = merge.c
// //             const endCellAddressR = merge.r + merge.rs - 1
// //             const endCellAddressC = merge.c + merge.cs - 1
// //             if (ref && ref.current) {
// //                 console.log("MERGING CELL")
// //                 ref.current.mergeCells([
// //                     { row: [startCellAddressR, endCellAddressR], column: [startCellAddressC, endCellAddressC] }
// //                 ], 'merge-horizontal')
// //             }
// //         })
// //     }
// // }, [mergeInfo])
