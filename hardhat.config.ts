import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import '@nomicfoundation/hardhat-chai-matchers';
import '@openzeppelin/hardhat-upgrades';
import "hardhat-contract-sizer";

const config: HardhatUserConfig = {
  solidity: "0.8.19",
};

export default config;
