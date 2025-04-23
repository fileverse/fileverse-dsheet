import {
    Popover,
    PopoverContent,
    PopoverTrigger,

} from '@fileverse/ui';
import { ChangeEventHandler } from 'react';
import icon from '../assets/icon.svg';
import './importButton.scss'

export const CustomButton = ({ handleCSVUpload }: { handleCSVUpload: ChangeEventHandler<HTMLInputElement> }) => {
    return (
        // <LucideIcon name="export-file" className="w-6 h-6" />

        // <button
        //     onClick={onClick}
        //     className="fortune-toolbar-custom-btn"
        //     style={{
        //         // margin: '0 8px',
        //         padding: '4px 8px',
        //         // backgroundColor: '#4a5568',
        //         color: 'white',
        //         border: 'none',
        //         borderRadius: '4px',
        //         cursor: 'pointer'
        //     }}
        // >
        //     {/* {label} */}
        //     <img src={icon} alt="Icon" style={{ width: '20px', height: '20px' }} />
        // </button>
        <Popover>
            <PopoverTrigger>
                <div
                    // onClick={onClick}
                    className="fortune-toolbar-custom-btn"
                    style={{
                        // margin: '0 8px',
                        padding: '4px 8px',
                        // backgroundColor: '#4a5568',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {/* {label} */}
                    <img src={icon} alt="Icon" style={{ width: '20px', height: '20px' }} />
                </div>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                alignOffset={0}
                className="w-72 p-2"
                elevation={2}
                side="bottom"
                sideOffset={4}
            >
                <div className="p-2 color-text-default">
                    <h1 className="export-text">
                        Export
                    </h1>
                    <p className="text-body-sm mt-2 btn">
                        Export as .xlsx
                    </p>
                    <p className="text-body-sm mt-2 btn">
                        Export as .csv
                    </p>
                </div>
                <div className="p-2 color-text-default">
                    <h1 className="export-text">
                        Import
                    </h1>
                    <div>
                        <label htmlFor="xlsx-upload" className="text-body-sm mt-2 btn">
                            Import .xlsx
                        </label>
                        <input
                            type="file"
                            accept=".xlsx"
                            id="xlsx-upload"
                            onChange={handleCSVUpload}
                            style={{ display: "none" }}
                        />
                    </div>
                    <div className='btn'>
                        <input
                            type="file"
                            accept=".csv"
                            id="csv-upload"
                            onChange={handleCSVUpload}
                            style={{ display: "none" }}
                        />
                        <label htmlFor="csv-upload"
                        >
                            <p className="text-body-sm mt-2 btn">
                                Import .csv
                            </p>
                        </label>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};