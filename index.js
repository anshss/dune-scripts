// index.js
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const {
    DuneClient,
    ColumnType,
    ContentType,
} = require("@duneanalytics/client-sdk");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");

const DUNE_URL = "https://api.dune.com/api";

// Define available blockchains with their respective RPC URLs and chain IDs
const blockchains = {
    chronicle: {
        rpcUrl:
            process.env.CHRONICLE_RPC_URL ||
            "https://chain-rpc.litprotocol.com/replica-http",
        chainId: 175177,
    },
    yellowstone: {
        rpcUrl:
            process.env.YELLOWSTONE_RPC_URL ||
            "https://yellowstone-rpc.litprotocol.com/",
        chainId: 175188,
    },
};

// Define the contracts (networks) with their respective addresses
const networks = {
    cayenne: "0x58582b93d978F30b4c4E812A16a7b31C035A69f7",
    habanero: "0x80182Ec46E3dD7Bb8fa4f89b48d303bD769465B2",
    manzano: "0x3c3ad2d238757Ea4AF87A8624c716B11455c1F9A",
    serrano: "0x8F75a53F65e31DD0D2e40d0827becAaE2299D111",
    datil_prod: "0x487A9D096BB4B7Ac1520Cb12370e31e677B175EA",
    datil_dev: "0x02C4242F72d62c8fEF2b2DB088A35a9F4ec741C7",
    datil_test: "0x6a0f439f064B7167A8Ea6B22AcC07ae5360ee0d1",
};

// ABI for the contract, including the PKPMinted event and getEthAddress function
const contractABI = [
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "tokenId",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "bytes",
                name: "pubkey",
                type: "bytes",
            },
        ],
        name: "PKPMinted",
        type: "event",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256",
            },
        ],
        name: "getEthAddress",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
];

async function fetchPKPs(startBlock, endBlock) {
    // Retrieve configuration from environment variables
    const selectedBlockchain = process.env.BLOCKCHAIN;
    const selectedNetwork = process.env.NETWORK;
    const blockInterval = parseInt(process.env.BLOCK_INTERVAL, 10) || 25000;

    // Ensure both blockchain and network are specified
    if (!selectedBlockchain || !selectedNetwork) {
        throw new Error(
            "Both BLOCKCHAIN and NETWORK must be specified in the environment variables."
        );
    }

    let results = [];

    // Get the RPC URL and chain ID for the specified blockchain
    const { rpcUrl, chainId } = blockchains[selectedBlockchain];
    if (!rpcUrl || !chainId) {
        throw new Error(`Invalid blockchain specified: ${selectedBlockchain}`);
    }

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
        name: selectedBlockchain,
        chainId,
    });

    // Get the contract address for the specified network
    const contractAddress = networks[selectedNetwork];
    if (!contractAddress) {
        throw new Error(`Invalid network specified: ${selectedNetwork}`);
    }

    const contract = new ethers.Contract(
        contractAddress,
        contractABI,
        provider
    );

    // Iterate through the blocks in intervals to query events
    for (
        let fromBlock = startBlock;
        fromBlock <= endBlock;
        fromBlock += blockInterval
    ) {
        const toBlock = Math.min(fromBlock + blockInterval - 1, endBlock);
        const filter = {
            address: contractAddress,
            fromBlock: fromBlock,
            toBlock: toBlock,
            topics: [ethers.utils.id("PKPMinted(uint256,bytes)")],
        };

        try {
            // Query events for the specified range of blocks
            const events = await contract.queryFilter(
                filter,
                fromBlock,
                toBlock
            );
            console.log(
                `Found ${events.length} PKPMinted events from block ${fromBlock} to ${toBlock} on ${selectedBlockchain} blockchain and ${selectedNetwork} network`
            );
            for (const event of events) {
                const tokenId = event.args.tokenId.toString();
                try {
                    // Fetch the ETH address associated with the tokenId
                    const ethAddress = await contract.getEthAddress(tokenId);
                    const result = `Blockchain: ${selectedBlockchain}, Network: ${selectedNetwork}, Token ID: ${tokenId} -> ETH Address: ${ethAddress}`;
                    console.log(result);
                    results.push({
                        blockchain: selectedBlockchain,
                        network: selectedNetwork,
                        tokenId,
                        ethAddress,
                    });
                } catch (error) {
                    console.error(
                        `Error fetching ETH address for Token ID ${tokenId} on ${selectedBlockchain} blockchain, ${selectedNetwork} network:`,
                        error
                    );
                }
            }
        } catch (error) {
            console.error(
                `Error fetching events from block ${fromBlock} to ${toBlock} on ${selectedBlockchain} blockchain, ${selectedNetwork} network:`,
                error
            );
        }

        // Add a delay between queries to avoid overloading the provider
        await new Promise((res) => setTimeout(res, 2000)); // 2 second delay
    }

    // Format and return results
    results = cleanArray(results);
    return results;
}

function cleanArray(dataArray) {
    // Remove rows with empty values
    const cleanedData = dataArray.filter((row) =>
        Object.values(row).every(
            (value) => value !== "" && value !== null && value !== undefined
        )
    );

    // Rename columns
    const renamedData = cleanedData.map((row) => ({
        blockchain: row["blockchain"],
        network: row["network"],
        token_id: row["tokenId"],
        eth_address: row["ethAddress"],
    }));

    return renamedData;
}

function convertToCSV(data) {
    const headers = "blockchain,network,token_id,eth_address";
    const rows = data
        .map(
            (row) =>
                `${row.blockchain},${row.network},${row.token_id},${row.eth_address}`
        )
        .join("\n");
    return `${headers}\n${rows}`;
}

function convertToNdJson(data) {
    return data.map((obj) => JSON.stringify(obj)).join("\n");
}

async function fetchEndBlock() {
    const query_id = "4134261";
    const endpoint = `/v1/query/${query_id}/results`;
    const url = `${DUNE_URL}${endpoint}`;

    const headers = {
        "X-DUNE-API-KEY": `${process.env.DUNE_API_KEY}`,
    };

    const response = await axios.get(url, { headers });

    return response.data.result.rows;
}

async function fetchTableData() {
    const query_id = process.env.DUNE_QUERY_ID_YELLOWSTONE_DATIL;
    const endpoint = `/v1/query/${query_id}/results/csv`;
    const url = `${DUNE_URL}${endpoint}`;

    const headers = {
        "X-DUNE-API-KEY": `${process.env.DUNE_API_KEY}`,
    };

    const response = await axios.get(url, { headers });

    return response.data;
}

async function updateDuneTable(_data) {
    const getTableCsvData = await fetchTableData();
    console.log("getTableCsvData: ", getTableCsvData);

    _data = convertToCSV(_data);

    // Append the new _data to the existing getTableCsvData
    let updatedCsvData;
    if (getTableCsvData) {
        // Remove header from _data if getTableCsvData is not empty
        const dataWithoutHeader = _data.split("\n").slice(1).join("\n");
        updatedCsvData = getTableCsvData + "\n" + dataWithoutHeader;
    } else {
        updatedCsvData = _data;
    }

    const dune_namespace = process.env.DUNE_NAMESPACE;
    const table_name = process.env.DUNE_TABLE_NAME_YELLOWSTONE_DATIL;
    const endpoint = `/v1/table/${dune_namespace}/${table_name}/insert`;
    const url = `${DUNE_URL}${endpoint}`;

    const headers = {
        "X-DUNE-API-KEY": `${process.env.DUNE_API_KEY}`,
        "Content-Type": "text/csv",
    };

    try {
        const response = await axios.post(url, updatedCsvData, { headers });
        return response;
    } catch (error) {
        console.error("Error updating Dune table:", error);
        throw error;
    }
}

async function updateEndBlock(_data) {
    const endBlocksOnDb = await fetchEndBlock();

    const dataToUpdate = {
        blockchain: process.env.BLOCKCHAIN,
        network: process.env.NETWORK,
        end_block: _data,
    };

    let updated = false;
    let updatedEndBlocksArray = endBlocksOnDb.map((item) => {
        if (
            item.blockchain === dataToUpdate.blockchain &&
            item.network === dataToUpdate.network
        ) {
            updated = true;
            return { ...item, end_block: dataToUpdate.end_block }; // Update the existing end_block
        }
        return item;
    });
    // If the combination doesn't exist, add a new entry
    if (!updated) {
        updatedEndBlocksArray.push(dataToUpdate);
    }

    updatedEndBlocksArray = convertToNdJson(updatedEndBlocksArray);
    console.log("updatedEndBlocksArray: ", updatedEndBlocksArray);

    const dune_namespace = process.env.DUNE_NAMESPACE;
    const table_name = "end_block";
    const endpoint = `/v1/table/${dune_namespace}/${table_name}/insert`;
    const url = `${DUNE_URL}${endpoint}`;

    const headers = {
        "X-DUNE-API-KEY": `${process.env.DUNE_API_KEY}`,
        "Content-Type": "application/x-ndjson",
    };

    try {
        const response = await axios.post(url, updatedEndBlocksArray, {
            headers,
        });
        return response;
    } catch (error) {
        console.error("Error updating Dune table:", error);
        throw error;
    }
}

async function main() {
    const blockchain = process.env.BLOCKCHAIN;
    const network = process.env.NETWORK;

    const fetchStartBlock = await fetchEndBlock();
    console.log(fetchStartBlock)

    const startBlock =
    fetchStartBlock
            .map((item) =>
                item.blockchain === blockchain && item.network === network
                    ? item.end_block
                    : null
            )
            .find((block) => block !== null) || 0;

    const { rpcUrl, chainId } = blockchains[blockchain];
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
        name: blockchain,
        chainId,
    });
    // const endBlock = await provider.getBlockNumber();
    const endBlock = startBlock + 100;

    console.log("Start Block: ", startBlock);
    console.log("End Block: ", endBlock);

    const PKPs = await fetchPKPs(startBlock, endBlock);
    console.log("PKPs: ", PKPs);

    const resDuneTableUpdate = await updateDuneTable(PKPs);
    console.log("Dune Table Updated: ", resDuneTableUpdate.data);

    const resEndBlockUpdate = await updateEndBlock(endBlock);
    console.log("End Block Updated: ", resEndBlockUpdate.data);
}

// async function checkDB() {
//   console.log("Fetching initial end block...");
//   const initialEndBlock = await fetchEndBlock();
//   console.log("Initial end block:", initialEndBlock);

//   console.log("Updating end block to 70900...");
//   const resEndBlockUpdate = await updateEndBlock(70900);
//   console.log("End Block Update Response:", resEndBlockUpdate.data);

//   console.log("Waiting 5 seconds for update to propagate...");
//   await new Promise(resolve => setTimeout(resolve, 5000));

//   console.log("Fetching updated end block...");
//   const updatedEndBlock = await fetchEndBlock();
//   console.log("Updated end block:", updatedEndBlock);
// }

main().catch((error) => {
    console.error("Unhandled error:", error);
});

// ------------------------------

// const dummyPkpArray = [
//     {
//         blockchain: "yellowstone",
//         network: "datil_prod",
//         token_id:
//             "9365417838328170688784621750843422999757712915165857517238501371202806961902",
//         eth_address: "0xf70363601654d452728151a931cF82467181459c",
//     },
// ];

function writeCSV(_data) {
    // // Save all results to a single CSV file
    const csv = _data
        .map(
            (row) =>
                `${row.blockchain},${row.network},${row.token_id},${row.eth_address}`
        )
        .join("\n");
    fs.writeFileSync(
        "results.csv",
        "Blockchain,Network,Token ID,ETH Address\n" + csv
    );
}

async function createTable() {
    const client = new DuneClient(process.env.DUNE_API_KEY);

    const schema = [
        { name: "blockchain", type: ColumnType.Varchar },
        { name: "network", type: ColumnType.Varchar },
        { name: "end_block", type: ColumnType.Integer },
    ];

    let dune_namespace = process.env.DUNE_NAMESPACE;
    let table_name = "end_block";
    table_name = table_name.replace(/-/g, "_");

    const createTableRes = await client.table.create({
        namespace: dune_namespace,
        table_name: table_name,
        schema: schema,
    });

    console.log("Table created:", createTableRes);
}
