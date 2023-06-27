import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";
import "@nomiclabs/hardhat-ethers";
import { BscTestnetConfig } from "hardhat/types/config";
import "dotenv/config";

const config: HardhatUserConfig & BscTestnetConfig = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Adjust the number of runs as needed
      },
    },
  },
  networks: {
    BSCTestnet: {
      url: "https://bsc-testnet.publicnode.com",
      chainId: 97,
      accounts: [process.env.PRIVATE_KEY || ""],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
