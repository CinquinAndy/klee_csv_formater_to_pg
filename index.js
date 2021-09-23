const fs = require("fs");
const fastcsv = require("fast-csv");
const Pool = require("pg").Pool;


// regex to dectect all name of csv files
const tableNameRegex = /(.*)(?:-data)(?:.*)(\.csv)/;
// Regex to match numbers in csv file
const matchNumberRegex = /(\d)*((\.)?(\d)*)?/;
// Regex to match spaces
const matchSpaces = /(\ )/g;
// Regex to match special char
const matchSpecial = /(\W)/g;
// Regex to match multiple Underscores
const matchMultipleUnderscores = /(_{2,})/g;

function cleanString(stringToTreat){
    // modify names, to full lower and without spaces
    stringToTreat=stringToTreat.toLowerCase().replace(matchSpaces,"_");
    stringToTreat=stringToTreat.replace(matchSpecial,"_");
    stringToTreat=stringToTreat.replace(matchMultipleUnderscores,"_");
    // delete underscore at the start & end
    stringToTreat=stringToTreat.replace(/^_/,"");
    stringToTreat=stringToTreat.replace(/_$/,"");
    return stringToTreat;
}

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

var allQueries = [];
for (const objectListCSVFile of objectListCSVFiles) {
    let stream = fs.createReadStream(`./csv/${objectListCSVFile.completeName}`);
    let csvData = [];
    let csvStream = fastcsv
        .parse()
        .on("data", function (data) {
            if (!!data.length) {
                for (const dataKey in data) {
                    // we don't make change line with time and hours, only others
                    // we just need to keep numbers, and don't change the first line
                    if (dataKey != 0 && data[0] !== "Time") {
                        data[dataKey] = data[dataKey].match(matchNumberRegex)[0];
                    }
                }
                csvData.push(data);
            }
        }).on("end", function () {
            // create a new connection pool to the database
            const pool = new Pool({
                host: process.env.HOST,
                user: process.env.USER,
                database: process.env.DATABASE,
                password: process.env.PASSWORD,
                port: process.env.PORT
            });
            // ---------------------------------- Part to create create table query -----------------------------------
            // create the query to create the table
            objectListCSVFile.name = cleanString(objectListCSVFile.name);

            var queryToCreateTable = `CREATE TABLE IF NOT EXISTS "${objectListCSVFile.name}"(time TIMESTAMP NOT NULL,`;
            for (const data in csvData[0]) {
                if (data != 0) {
                    // replace spaces & add all columns
                    queryToCreateTable += `${cleanString(csvData[0][data])} DOUBLE PRECISION NOT NULL,`
                }
            }
            queryToCreateTable += ` PRIMARY KEY (time) )`;

            // ---------------------------------- Part to create insert query -----------------------------------
            var allInsert = [];
            var queryToInsert = "";
            var baseQueryToInsert = "";
            // create query to insert data
            for (const csvDataKey in csvData) {
                if (csvDataKey == 0) {
                    // we start the query, add the time [ we will is it as primary key ]
                    baseQueryToInsert = `INSERT INTO "${objectListCSVFile.name}"(time`
                    for (const data in csvData[csvDataKey]) {
                        if (data != 0) {
                            baseQueryToInsert += `,${cleanString(csvData[csvDataKey][data])}`;
                        }
                    }
                    baseQueryToInsert += ") VALUES(";
                } else {
                    // we add values to the query
                    queryToInsert = baseQueryToInsert;
                    for (const csvDataKeyKey in csvData[csvDataKey]) {
                        // if it's the first value, we don't add a ','
                        queryToInsert += `${csvDataKeyKey == 0 ? "" : ","}${csvData[csvDataKey][csvDataKeyKey]}`
                    }
                    queryToInsert += ") ON CONFLICT DO NOTHING;";
                    // finally we push the array query's
                    allInsert.push(queryToInsert);
                }
            }
            // Then push the values to the final variable
            allQueries.push({
                name:objectListCSVFile.name,
                tableQuery:queryToCreateTable,
                insertQuery:queryToInsert
            })
            // Verify that all works
            if(allQueries.length===objectListCSVFiles.length){
                console.log(allQueries);
            }
        });
    stream.pipe(csvStream);
}
