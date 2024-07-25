
# Lit Protocol PKP Address Extractor

This project is designed to extract PKP (Public Key Pair) addresses from the Lit Protocol on specified networks and chains. It allows you to extract information from multiple chains and networks, or just from specific ones as per your requirements.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Usage](#usage)
  - [Running the Script](#running-the-script)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
- [Output](#output)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Prerequisites

- [Node.js](https://nodejs.org/) (version 14.x or higher)
- NPM (comes with Node.js)

## Setup

1. **Clone the repository:**

   ```sh
   git clone https://github.com/marco12369/PKP-addresses-extraction-script.git
   cd PKP-addresses-extraction-script
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Create a `.env` file in the root of the project with the following content:**

   ```env
   BLOCKCHAIN=all
   NETWORK=all
   BLOCK_INTERVAL=25000
   START_BLOCK=0
   END_BLOCK=latest
   CHRONICLE_RPC_URL=https://chain-rpc.litprotocol.com/replica-http
   YELLOWSTONE_RPC_URL=https://yellowstone-rpc.litprotocol.com/
   ```

## Usage

### Running the Script

1. **Ensure you are in the project directory:**

   ```sh
   cd PKP-addresses-extraction-script
   ```

2. **Run the script:**

   ```sh
   npm start
   ```

   - If `BLOCKCHAIN` and `NETWORK` are not specified, the script will process all networks on both blockchains.
   - If `BLOCKCHAIN` is specified but `NETWORK` is not, the script will process all networks on the specified blockchain.
   - If both `BLOCKCHAIN` and `NETWORK` are specified, the script will process the specified network on the specified blockchain.

## Configuration

### Environment Variables

The script uses environment variables to configure which blockchains and networks to extract data from. These variables should be defined in a `.env` file in the root directory of the project.

- **BLOCKCHAIN**: Specifies which blockchain to extract data from. Options are `chronicle` and `yellowstone`. If not set, both blockchains will be processed.
- **NETWORK**: Specifies which network to extract data from. Options are `cayenne`, `habanero`, `manzano`, `serrano`, and `datil`. If not set, all networks will be processed.
- **START_BLOCK**: The starting block number for extracting events.
- **END_BLOCK**: The ending block number for extracting events.
- **BLOCK_INTERVAL**: The interval of blocks to process in each query.

Example `.env` file:

```env
BLOCKCHAIN=chronicle # Options: chronicle, yellowstone
NETWORK=serrano # Optional, set this if you want to process a specific network
BLOCK_INTERVAL=25000 
START_BLOCK=0
END_BLOCK=latest
CHRONICLE_RPC_URL=https://chain-rpc.litprotocol.com/replica-http
YELLOWSTONE_RPC_URL=https://yellowstone-rpc.litprotocol.com/
```

## Output

The results will be saved in a `results.csv` file in the project directory, containing the following columns:

- **Blockchain**
- **Network**
- **Token ID**
- **ETH Address**

## Troubleshooting

- **Ensure you have the correct Node.js version**: The script requires Node.js version 14.x or higher.
- **Check your environment variables**: Make sure your `.env` file is correctly configured.
- **Review error messages**: Any errors encountered during execution will be logged to the console. Review these messages for hints on what might be wrong.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
