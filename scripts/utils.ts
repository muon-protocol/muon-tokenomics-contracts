import { ethers, upgrades } from "hardhat";
import { BigNumber } from 'ethers';
import { PION, VePION } from "../typechain-types";

export const MAX_UINT = BigNumber.from('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');

export async function deploy(treasury: string) {
    const [
        PION,
        vePION
    ] = await Promise.all([
        ethers.getContractFactory("PION"),
        ethers.getContractFactory("VePION"),
    ])

    const pion = (await upgrades.deployProxy(PION, [])) as PION
    const vePion = (await upgrades.deployProxy(vePION, [pion.address, treasury])) as VePION

    return {
        pion,
        vePion,
    }
}

export async function testDeployLocally() {

    const signers = await ethers.getSigners();
    const treasury = signers[signers.length - 1].address

    const contracts = await deploy(treasury)

    return {
        ...contracts,
        treasury
    }
}

export async function deployTestToken() {
    const TestToken = await ethers.getContractFactory("TestToken")
    const token = await TestToken.deploy()
    await token.deployTransaction.wait()
    await token.deployed()
    return token
}