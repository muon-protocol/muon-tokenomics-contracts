# PION and bonPION

This technical document provides a comprehensive overview of the Muon staking mechanism, detailing the data flow and the interrelationships between its various components. Primarily intended for developers and auditors, the document delves into the intricacies of the Muon staking system.


## What is PION and bonPION

Muon staking aims to implement a system where NFT tokens can be staked, and rewards are calculated based on the fungible tokens locked within the staked NFTs. Two major components of this system, bonded `PION` (`bonPION`) and `PION`, will be discussed in detail.

### PION
The `PION` token is an `ERC20Upgradeable` contract that allows the owner to pause and unpause it. The `bonPION` contract burns `PION` tokens upon approval when they are locked underlying an NFT (`bonPION`).

### bonPION
bonPION is an `ERC721Upgradeable` contract that can be paused and unpaused at the owner's request. It handles the NFTs issued for a user and the corresponding locked tokens associated with those NFTs. There are two types of tokens that can be locked within `bonPION`. The first type is `PION` tokens, which are burned upon being locked by `bonPION` based on the approved locked amount from the user. The second type consists of any other tokens eligible for locking, as specified in the `tokensWhitelist`. These tokens are transferred to the `treasury` address upon locking.

Users have the ability to mint an NFT with no initial value and subsequently lock a desired amount of a specific token or multiple tokens to be represented by the corresponding NFT. It is important to note that these NFTs cannot be transferred to any address except those listed in the `transferWhitelist`. Additionally, there is a `mintAndLock` function that combines the minting and locking processes into a single transaction.

bonPION allows users to merge the tokens underlying two NFTs. In this scenario, one NFT is burned, and the other NFT represents the combined locked tokens. bonPION also facilitates the splitting (i.e., `split` function) of locked tokens underlying an NFT into two separate NFTs. This process involves issuing a new NFT and transferring a portion of the locked tokens, as determined by the user, to underlie the new NFT.

## Installation

To install and set up the Muon staking system, follow these steps:

1. Clone the repository:
   ```
   git clone https://github.com/muon-protocol/muon-tokenomics-contracts.git
   ```

2. Install the required dependencies:
   ```
   npm install
   ```
   
## Testing

To run the tests for the Muon staking system using Hardhat, execute the following command:

```
npx hardhat test
```

This will execute the test suite and provide detailed output regarding the functionality and behavior of the contracts. or execute

```
REPORT_GAS=true npx hardhat test
```

This command will execute the test suite while also providing detailed gas consumption reports for each test case. It allows developers and auditors to analyze the gas usage of the contract functions and assess their efficiency.

## Deployment

To deploy the Muon staking contracts to a specific network, ensure that the network settings are correctly configured in the deployment scripts. Then, run the deployment command:

```
npx hardhat run scripts/deploy.ts --network <network-name>
```

Replace `<network-name>` with the desired network identifier, such as `mainnet`. This will deploy the contracts to the specified network.

Please note that the deployment process may require additional configuration, such as providing the necessary account credentials or API keys for interacting with the target network.