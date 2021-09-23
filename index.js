const fs = require("fs");
const fastcsv = require("fast-csv");

// regex to dectect all name of csv files
const tableNameRegex = /(.*)(?:-data)(?:.*)(\.csv)/;

var listCSVFiles = [];
var objectListCSVFiles = [];
// get all files in csv folder
listCSVFiles = fs.readdirSync("./csv");

// run in the folder, then create object in array, with name without date,
// and with filename.csv
for (const listCSVFilesKey of listCSVFiles) {
    objectListCSVFiles.push({
        name: listCSVFilesKey.match(tableNameRegex)[1],
        completeName: listCSVFilesKey
    })
}

console.log(objectListCSVFiles);
