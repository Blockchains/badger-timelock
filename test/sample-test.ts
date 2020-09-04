import { ethers } from "@nomiclabs/buidler";
import { Signer, Contract, BigNumber, utils } from "ethers";

import SmartTimelock from "../artifacts/SmartTimelock.json";
import {
  deployGnosisSafeInfrastructure,
  deployGnosisSafe,
} from "./gnosis-safe/deploy";
import {
  deployAragonInfrastructure,
  deployBadgerDAO,
  DAOParams,
  BadgerDAO,
} from "./aragon/deploy";
import { getCurrentTimestamp } from "./helpers/time";
import { deployContract } from "ethereum-waffle";

describe("Token", function () {
  let accounts: Signer[];

  let deployer: Signer;
  let deployerAddress: string;

  let team: Signer[];
  let teamAddresses: string[];

  let smartTimelock: Contract;
  let safe: Contract;
  let daoSystem: BadgerDAO;
  let votingApp: Contract;

  let daoParams: DAOParams;

  before(async function () {
    this.timeout(0);

    accounts = await ethers.getSigners();
    deployer = accounts[0];
    deployerAddress = await deployer.getAddress()
    team = [accounts[1], accounts[2], accounts[3]];
    teamAddresses = [await team[0].getAddress(), await team[1].getAddress(), await team[2].getAddress()];

    daoParams = {
      tokenName: "Badger",
      tokenSymbol: "BADGER",
      id: "badger-finance",
      holders: [await deployer.getAddress()],
      stakes: [utils.parseEther("21000000")],
      votingSettings: [
        utils.parseEther("0.5"),
        utils.parseEther("0.05"),
        BigNumber.from(86400),
      ],
      useAgentAsVault: true,
      financePeriod: BigNumber.from(0),
    };

    // Deploy infrastructure once
    await deployAragonInfrastructure(deployer);
    await deployGnosisSafeInfrastructure(deployer);
  });

  beforeEach(async function () {
    daoSystem = await deployBadgerDAO(deployer, daoParams);

    safe = await deployGnosisSafe(deployer, [
      [...teamAddresses],
      2,
      ethers.constants.AddressZero,
      "0x",
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      0,
      ethers.constants.AddressZero,
    ]);

    const unlockTime = getCurrentTimestamp() + 1000000;
    smartTimelock = await deployContract(deployer, SmartTimelock, [daoSystem.token.address, safe.address, BigNumber.from(unlockTime)]);

    // Transfer gTokens to Timelock
    await (await daoSystem.token.transfer(smartTimelock.address, utils.parseEther("15000000")));

    // Create proposal
    const voteId = 0;

    // Attempt to vote
    const iface = new ethers.utils.Interface(SmartTimelock.abi)
    const encoded = iface.encodeFunctionData('vote', [daoSystem.voting.address, voteId, true, true])
    // Ownership - Try to execute functions or take funds as non-beneficiary
  });

  it("should do something right", async function () {
    // Do something with the accounts
  });
});
