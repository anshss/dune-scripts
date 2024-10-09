// index.js
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
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

async function fetchPKPs(startBlock, endBlock, _blockchain, _network) {
    // Retrieve configuration from environment variables
    const selectedBlockchain = _blockchain;
    const selectedNetwork = _network;
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

function convertToEndBlockCSV(data) {
    const headers = "blockchain,end_block,network";
    const rows = data
        .map(
            (row) =>
                `${row.blockchain},${row.end_block},${row.network}`
        )
        .join("\n");
    return `${headers}\n${rows}`;
}

function convertToNdJson(data) {
    return data.map((obj) => JSON.stringify(obj)).join("\n");
}

async function fetchTableData() {
    const query_id = process.env.DUNE_QUERY_ID_YELLOWSTONE_DATIL;
    const endpointQuery = `/v1/query/${query_id}/results/csv`;
    const url = `${DUNE_URL}${endpointQuery}`;

    const config = {
        headers: { 
          'X-DUNE-API-KEY': process.env.DUNE_API_KEY, 
        }
      };
    const response = await axios.get(url, config);

    return response.data;
}

async function updateDuneTable(_data) {
    const getTableCsvData = await fetchTableData();
    console.log("getTableCsvData: ", getTableCsvData);

    _data = convertToCSV(_data);

    // update the existing table if data exist or add new data
    let updatedCsvData;
    if (getTableCsvData) {
        const dataWithoutHeader = _data.split("\n").slice(1).join("\n");
        updatedCsvData = getTableCsvData + "\n" + dataWithoutHeader;
    } else {
        updatedCsvData = _data;
    }

    const dune_namespace = process.env.DUNE_NAMESPACE;
    const table_name = process.env.DUNE_TABLE_NAME_YELLOWSTONE_DATIL;

    // append in existing db
    try {
        const endpoint = `/v1/table/${dune_namespace}/${table_name}/insert`;
        const url = `${DUNE_URL}${endpoint}`;
    
        const config = {
            headers: { 
              'X-DUNE-API-KEY': process.env.DUNE_API_KEY, 
              'Content-Type': 'application/json'
            }
          };

        const response = await axios.post(url, updatedCsvData, config);
        // return response;
    } catch (error) {
        console.error("Error updating Dune table:", error);
        throw error;
    }

    // refresh db with new data
    try {
        const query_id = process.env.DUNE_QUERY_ID_YELLOWSTONE_DATIL;
        const endpoint = `/v1/query/${query_id}/execute`;
        const url = `${DUNE_URL}${endpoint}`;

        const config = {
            headers: { 
              'X-DUNE-API-KEY': process.env.DUNE_API_KEY,
            }
          };
        const response = await axios.post(url, null, config);

    } catch (error) {
        console.error("Error updating Dune table:", error);
        throw error;
    }
}

async function fetchEndBlock() {
    const query_id = process.env.DUNE_QUERY_ID_END_BLOCK;
    const endpointQuery = `/v1/query/${query_id}/results`;
    const url = `${DUNE_URL}${endpointQuery}`;

    const config = {
        headers: { 
          'X-DUNE-API-KEY': process.env.DUNE_API_KEY
        }
      };
    const response = await axios.get(url, config);

    return response.data.result.rows;
}

async function updateEndBlock(_data, _blockchain, _network) {
    let response;
    const endBlocksOnDb = await fetchEndBlock();

    const dataToUpdate = {
        blockchain: _blockchain,
        network: _network,
        end_block: _data,
    };

    // Update the end block if the combination already exists or create new entry
    let updated = false;
    let updatedEndBlocksArray = endBlocksOnDb.map((item) => {
        if (
            item.blockchain === dataToUpdate.blockchain &&
            item.network === dataToUpdate.network
        ) {
            updated = true;
            return { ...item, end_block: dataToUpdate.end_block }
        }
        return item;
    });

    // If the combination doesn't exist, add a new entry
    if (!updated) {
        updatedEndBlocksArray.push(dataToUpdate);
    }

    updatedEndBlocksArray = convertToNdJson(updatedEndBlocksArray);
    // console.log("updatedEndBlocksArray: ", updatedEndBlocksArray);

    const dune_namespace = process.env.DUNE_NAMESPACE;
    
    // remove existing and update db with new data
    try {
        const table_name = process.env.DUNE_TABLE_NAME_END_BLOCK;
        const endpoint = `/v1/table/upload/csv`;
        const url = `${DUNE_URL}${endpoint}`;


        let newData = [
            {
                blockchain: 'yellowstone',
                end_block: 0,
                network: 'datil_prod'
            }
        ]
        newData = convertToEndBlockCSV(newData);
        console.log("newData", newData)

        const data = {
            data: newData,
            description: "hahah",
            table_name: table_name,
            is_private: false
          };
        
          const config = {
            headers: { 
              'X-DUNE-API-KEY': process.env.DUNE_API_KEY, 
              'Content-Type': 'application/json'
            }
          };

        const res = await axios.post(url, data, config);
        response = {...response, updateResponse: res.data}
        console.log("Table Updated", response);
    } catch (error) {
        console.error("Error updating Dune table:", error);
        throw error;
    }

    // refresh db with new data
    try {
        const query_id = process.env.DUNE_QUERY_ID_END_BLOCK;
        const endpoint = `/v1/query/${query_id}/execute`;
        const url = `${DUNE_URL}${endpoint}`;

        const config = {
            headers: { 
              'X-DUNE-API-KEY': process.env.DUNE_API_KEY
            }
          };
        const response = await axios.post(url, null, config);
        console.log(response.data);

    } catch (error) {
        console.error("Error updating Dune table:", error);
        throw error;
    }

}

async function main() {
    const blockchain = process.env.BLOCKCHAIN;
    const network = process.env.NETWORK;

    const fetchStartBlock = await fetchEndBlock();
    console.log(fetchStartBlock);

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

    const PKPs = await fetchPKPs(startBlock, endBlock, blockchain, network);
    console.log("PKPs: ", PKPs);

    const resDuneTableUpdate = await updateDuneTable(PKPs);
    console.log("Dune Table Updated: ", resDuneTableUpdate.data);

    const resEndBlockUpdate = await updateEndBlock(
        endBlock,
        blockchain,
        network
    );
    console.log("End Block Updated: ", resEndBlockUpdate.data);
}

async function checkDB() {
    const blockchain = process.env.BLOCKCHAIN;
    const network = "datil_prod";

    console.log("Fetching initial end block...");
    const initialEndBlock = await fetchEndBlock();
    console.log("Initial end block:", initialEndBlock);

    // console.log("Updating end block to 70900...");
    const resEndBlockUpdate = await updateEndBlock(70000, blockchain, network);
    // // console.log("End Block Update Response:", resEndBlockUpdate.data);

    console.log("Waiting 5 seconds for update to propagate...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log("Fetching updated end block...");
    const updatedEndBlock = await fetchEndBlock();
    console.log("Updated end block:", updatedEndBlock);

    // const re = await createTable()
    // console.log(re)
}

checkDB().catch((error) => {
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
    const schema = [
        { name: "blockchain", type: "varchar" },
        { name: "network", type: "varchar" },
        { name: "end_block", type: "integer" },
    ];

    let dune_namespace = process.env.DUNE_NAMESPACE;
    let table_name = "end_block_2";

    const endpoint = `/v1/table/create`;
    const url = `${DUNE_URL}${endpoint}`;

    const payload = {
        namespace: dune_namespace,
        table_name: table_name,
        description: "table for storing end blocks",
        schema: schema,
        is_private: false,
    };

    const headers = {
        "X-DUNE-API-KEY": `${process.env.DUNE_API_KEY}`,
        "Content-Type": "application/json",
    };

    try {
        const response = await axios.post(url, payload, {
            headers,
        });
        return response;
    } catch (error) {
        console.error("Error updating Dune table:", error);
        throw error;
    }
}
