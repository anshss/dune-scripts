// index.js
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

// Define available blockchains with their respective RPC URLs and chain IDs
const blockchains = {
  chronicle: {
    rpcUrl: process.env.CHRONICLE_RPC_URL || 'https://chain-rpc.litprotocol.com/replica-http',
    chainId: 175177
  },
  yellowstone: {
    rpcUrl: process.env.YELLOWSTONE_RPC_URL || 'https://yellowstone-rpc.litprotocol.com/',
    chainId: 175188
  }
};

// Define the contracts (networks) with their respective addresses
const networks = {
  cayenne: '0x58582b93d978F30b4c4E812A16a7b31C035A69f7',
  habanero: '0x80182Ec46E3dD7Bb8fa4f89b48d303bD769465B2',
  manzano: '0x3c3ad2d238757Ea4AF87A8624c716B11455c1F9A',
  serrano: '0x8F75a53F65e31DD0D2e40d0827becAaE2299D111',
  datil: '0xb2C52356C307Dd4e088a0589db47a4865a74392c'
};

// ABI for the contract, including the PKPMinted event and getEthAddress function
const contractABI = [
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "pubkey",
        "type": "bytes"
      }
    ],
    "name": "PKPMinted",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "tokenId",
        "type": "uint256"
      }
    ],
    "name": "getEthAddress",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function main() {
  // Retrieve configuration from environment variables or set defaults
  const selectedBlockchain = process.env.BLOCKCHAIN || 'all';
  const selectedNetwork = process.env.NETWORK || 'all';
  const blockInterval = parseInt(process.env.BLOCK_INTERVAL, 10) || 25000;
  const startBlock = parseInt(process.env.START_BLOCK, 10) || 0;
  
  let results = [];

  // Determine which blockchains and networks to use
  const blockchainsToUse = selectedBlockchain === 'all' ? Object.keys(blockchains) : [selectedBlockchain];
  const networksToUse = selectedNetwork === 'all' ? Object.keys(networks) : [selectedNetwork];

  // Iterate over each selected blockchain
  for (const blockchain of blockchainsToUse) {
    const { rpcUrl, chainId } = blockchains[blockchain];
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, { name: blockchain, chainId });

    // Iterate over each selected network (contract)
    for (const network of networksToUse) {
      const contractAddress = networks[network];
      const contract = new ethers.Contract(contractAddress, contractABI, provider);

      // Determine the end block number, either from environment variable or the latest block
      const endBlock = parseInt(process.env.END_BLOCK, 10) || await provider.getBlockNumber();

      // Iterate through the blocks in intervals to query events
      for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += blockInterval) {
        const toBlock = Math.min(fromBlock + blockInterval - 1, endBlock);
        const filter = {
          address: contractAddress,
          fromBlock: fromBlock,
          toBlock: toBlock,
          topics: [
            ethers.utils.id("PKPMinted(uint256,bytes)")
          ]
        };

        try {
          // Query events for the specified range of blocks
          const events = await contract.queryFilter(filter, fromBlock, toBlock);
          console.log(`Found ${events.length} PKPMinted events from block ${fromBlock} to ${toBlock} on ${blockchain} blockchain and ${network} network`);
          for (const event of events) {
            const tokenId = event.args.tokenId.toString();
            try {
              // Fetch the ETH address associated with the tokenId
              const ethAddress = await contract.getEthAddress(tokenId);
              const result = `Blockchain: ${blockchain}, Network: ${network}, Token ID: ${tokenId} -> ETH Address: ${ethAddress}`;
              console.log(result);
              results.push({ blockchain, network, tokenId, ethAddress });
            } catch (error) {
              console.error(`Error fetching ETH address for Token ID ${tokenId} on ${blockchain} blockchain, ${network} network:`, error);
            }
          }
        } catch (error) {
          console.error(`Error fetching events from block ${fromBlock} to ${toBlock} on ${blockchain} blockchain, ${network} network:`, error);
        }

        // Add a delay between queries to avoid overloading the provider
        await new Promise(res => setTimeout(res, 2000));  // 2 second delay
      }
    }
  }

  // Save all results to a single CSV file
  const csv = results.map(row => `${row.blockchain},${row.network},${row.tokenId},${row.ethAddress}`).join('\n');
  fs.writeFileSync('results.csv', 'Blockchain,Network,Token ID,ETH Address\n' + csv);
}

main().catch(error => {
    console.error("Unhandled error:", error);
});
