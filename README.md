The Muon staking system is used for adding nodes to the Muon oracle network. To find out more details about how the Muon staking system works you can see this [wiki page](https://github.com/muon-protocol/muon-tokenomics-contracts/wiki).

# Installation

To install and set up the Muon staking system, follow these steps:

1. Clone the repository:
   ```
   git clone https://github.com/muon-protocol/muon-tokenomics-contracts.git
   ```

2. Install the required dependencies:
   ```
   npm install
   ```
   
# Testing

To run the tests for the Muon staking system using Hardhat, execute the following command:

```
npx hardhat test
```

This will execute the test suite and provide detailed output regarding the functionality and behavior of the contracts. or execute

```
REPORT_GAS=true npx hardhat test
```

This command will execute the test suite while also providing detailed gas consumption reports for each test case. It allows developers and auditors to analyze the gas usage of the contract functions and assess their efficiency.

# Deployment

To deploy the Muon staking contracts to a specific network, ensure that the network settings are correctly configured in the deployment scripts. Then, run the deployment command:

```
npx hardhat run scripts/deploy.ts --network <network-name>
```

Replace `<network-name>` with the desired network identifier, such as `mainnet`. This will deploy the contracts to the specified network.

Please note that the deployment process may require additional configuration, such as providing the necessary account credentials or API keys for interacting with the target network.
