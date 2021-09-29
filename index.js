require('dotenv').config();
const fs = require("fs");
const fastcsv = require("fast-csv");
const {Pool} = require('pg')
const path = require("path");

const pool = new Pool(
    {
        host: process.env.HOST,
        user: process.env.USER,
        database: process.env.DATABASE,
        password: process.env.PASSWORD,
        port: process.env.PORT
    }
);

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

function cleanString(stringToTreat) {
    // modify names, to full lower and without spaces
    stringToTreat = stringToTreat.toLowerCase().replace(matchSpaces, "_");
    stringToTreat = stringToTreat.replace(matchSpecial, "_");
    stringToTreat = stringToTreat.replace(matchMultipleUnderscores, "_");
    // delete underscore at the start & end
    stringToTreat = stringToTreat.replace(/^_/, "");
    stringToTreat = stringToTreat.replace(/_$/, "");
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
        completeName: listCSVFilesKey,
        unit: ""
    })
}

var allQueries = [];
for (const objectListCSVFile of objectListCSVFiles) {
    let stream = fs.createReadStream(`./csv/${objectListCSVFile.completeName}`);
    let csvData = [];
    let csvStream = fastcsv
        .parse()
        .on("data", function (data) {
            // returns either true or false
            if (!!data.length) {
                for (const dataKey in data) {
                    // we don't make change line with time and hours, only others
                    // we just need to keep numbers, and don't change the first line
                    if (dataKey != 0 && data[0] !== "Time") {
                        objectListCSVFile.unit = data[dataKey].replace(data[dataKey].match(matchNumberRegex)[0], "").trim();
                        data[dataKey] = data[dataKey].match(matchNumberRegex)[0];
                    }
                }
                csvData.push(data);
            }
        }).on("end", function () {
                // ---------------------------------- Part to create create table query -----------------------------------
                // create the query to create the table
                objectListCSVFile.name = cleanString(objectListCSVFile.name);

                var queryToCreateTable = `CREATE TABLE IF NOT EXISTS "klee_${objectListCSVFile.name}"
                                          (
                                              time  TIMESTAMP NOT NULL,
                                              unite varchar(50),`;
                for (const data in csvData[0]) {
                    if (data != 0) {
                        // replace spaces & add all columns
                        queryToCreateTable += `${cleanString(csvData[0][data])} DOUBLE PRECISION NOT NULL,`
                    }
                }
                queryToCreateTable += ` PRIMARY KEY (time));`;

                // ---------------------------------- Part to create insert query -----------------------------------
                var allInsert = [];
                var queryToInsert = "";
                var baseQueryToInsert = "";
                // create query to insert data
                for (const csvDataKey in csvData) {
                    if (csvDataKey == 0) {
                        // we start the query, add the time [ we will is it as primary key ]
                        baseQueryToInsert = `INSERT INTO "klee_${objectListCSVFile.name}"(time, unite`
                        for (const data in csvData[csvDataKey]) {
                            if (data != 0) {
                                baseQueryToInsert += `,${cleanString(csvData[csvDataKey][data])}`;
                            }
                        }
                        baseQueryToInsert += ") VALUES('";
                    } else {
                        // we add values to the query
                        queryToInsert = baseQueryToInsert;
                        for (const csvDataKeyKey in csvData[csvDataKey]) {
                            // if it's the first value, we don't add a ','
                            csvData[csvDataKey][csvDataKeyKey] = !!csvData[csvDataKey][csvDataKeyKey] ? csvData[csvDataKey][csvDataKeyKey] : 0 ;
                            if (!(csvDataKeyKey == 1)) {
                                queryToInsert += `${csvDataKeyKey == 0 ? "" : ","}${csvData[csvDataKey][csvDataKeyKey]}`
                            } else {
                                queryToInsert += `','${objectListCSVFile.unit}'`
                                queryToInsert += `${csvDataKeyKey == 0 ? "" : ","}${csvData[csvDataKey][csvDataKeyKey]}`
                            }
                        }
                        queryToInsert += ") ON CONFLICT DO NOTHING;";
                        // finally we push the array query's
                        allInsert.push(queryToInsert);
                    }
                }
                // Then push the values to the final variable
                allQueries.push({
                    name: objectListCSVFile.name,
                    tableQuery: queryToCreateTable,
                    insertQuery: allInsert
                })
                // Verify that all works
                if (allQueries.length === objectListCSVFiles.length) {
                    (async () => {
                        // note: we don't try/catch this because if connecting throws an exception
                        // we don't need to dispose of the client (it will be undefined)
                        const client = await pool.connect()
                        try {
                            await client.query('BEGIN')
                            for (const queryToExec of allQueries) {
                                await client.query(queryToExec.tableQuery);
                                for (const queryKey in queryToExec.insertQuery) {
                                    await client.query(queryToExec.insertQuery[queryKey]);
                                }
                            }
                            await client.query('COMMIT')
                        } catch (e) {
                            await client.query('ROLLBACK')
                            throw e
                        } finally {
                            client.release()
                        }
                    })().catch(e => console.error(e.stack));
                }
            }
        );
    stream.pipe(csvStream);
}
