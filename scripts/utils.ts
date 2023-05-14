import { ethers, upgrades } from "hardhat";
import { PION, VePION } from "../typechain-types";

export async function deploy() {
    const [
        PION,
        vePION
    ] = await Promise.all([
        ethers.getContractFactory("PION"),
        ethers.getContractFactory("VePION"),
    ])

    const pion = (await upgrades.deployProxy(PION, [])) as PION
    const vePion = (await upgrades.deployProxy(vePION, [pion.address])) as VePION

    return {
        pion,
        vePion
    }
}