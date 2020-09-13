import { Contract } from "ethers";

import ERC20 from "../../dependency-artifacts/badger-dao/ERC20.json";

export async function getTokenBalances(provider, tokens: string[], accounts: string[]) {
    const balances = {};
    for (const account of accounts) {
        balances[account] = {};
        for (const token of tokens) {
            const tokenContract = new Contract(token, ERC20.abi, provider);
            balances[account][token] = await tokenContract.balanceOf(account);
        }
    }

    return balances;
}

