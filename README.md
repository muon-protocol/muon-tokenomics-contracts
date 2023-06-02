## PION and VePION Contract Functionality

This technical document provides a comprehensive overview of the Muon staking mechanism, detailing the data flow and the interrelationships between its various components. Primarily intended for developers and auditors, the document delves into the intricacies of the Muon staking system.

Muon staking aims to implement a system where NFT tokens can be staked, and rewards are calculated based on the fungible tokens locked within the staked NFTs. Two major components of this system, `VePION` and `PION`, will be discussed in detail.

### PION
The `PION` token is an `ERC20Upgradeable` contract that allows the owner to pause and unpause it. The `VePION` contract burns `PION` tokens upon approval when they are locked underlying an NFT (`VePION`).

### VePION
VePION is an `ERC721Upgradeable` contract that can be paused and unpaused at the owner's request. It handles the NFTs issued for a user and the corresponding locked tokens associated with those NFTs. There are two types of tokens that can be locked within `VePION`. The first type is `PION` tokens, which are burned upon being locked by `VePION` based on the approved locked amount from the user. The second type consists of any other tokens eligible for locking, as specified in the `tokensWhitelist`. These tokens are transferred to the `treasury` address upon locking.

Users have the ability to mint an NFT with no initial value and subsequently lock a desired amount of a specific token or multiple tokens to be represented by the corresponding NFT. It is important to note that these NFTs cannot be transferred to any address except those listed in the `transferWhitelist`. Additionally, there is a `mintAndLock` function that combines the minting and locking processes into a single transaction.

VePION allows users to merge the tokens underlying two NFTs. In this scenario, one NFT is burned, and the other NFT represents the combined locked tokens. VePION also facilitates the splitting (i.e., `split` function) of locked tokens underlying an NFT into two separate NFTs. This process involves issuing a new NFT and transferring a portion of the locked tokens, as determined by the user, to underlie the new NFT.