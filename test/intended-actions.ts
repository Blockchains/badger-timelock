import { ethers } from "@nomiclabs/buidler";
import { Signer, Contract, BigNumber, utils, Bytes } from "ethers";

import SmartTimelock from "../artifacts/SmartTimelock.json";
import MockToken from "../artifacts/MockToken.json";
import ERC20 from "../dependency-artifacts/badger-dao/ERC20.json";
import TokenGifter from "../artifacts/TokenGifter.json";
import EthGifter from "../artifacts/EthGifter.json";

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
import {
  getCurrentTimestamp,
  setNextBlockTimestamp,
  increaseTime,
} from "./helpers/time";
import { deployContract } from "ethereum-waffle";
import { expect } from "chai";
import { generateScript } from "./helpers/evmScripts";
import { setEvmSnapshot, revertEvmSnapshot } from "./helpers/ethSnapshot";

const iSmartTimelock = new ethers.utils.Interface(SmartTimelock.abi);
const iERC20 = new ethers.utils.Interface(ERC20.abi);
const iTokenGifter = new ethers.utils.Interface(TokenGifter.abi);
const iEthGifter = new ethers.utils.Interface(EthGifter.abi);

const tokenGifterAmount = utils.parseEther("500");
const tokenRequestAmount = utils.parseEther("100");

const ONE_ETHER = utils.parseEther("1");

describe("Token", function() {
  let accounts: Signer[];

  let deployer: Signer;
  let deployerAddress: string;
  let provider: any;

  let minnow: Signer;
  let minnowAddress: string;

  let team: Signer[];
  let teamAddresses: string[];

  let smartTimelock: Contract;
  let safe: Contract;
  let daoSystem: BadgerDAO;
  let votingApp: Contract;

  let tokenGifter: Contract;
  let ethGifter: Contract;

  let miscToken: Contract;

  let daoParams: DAOParams;
  let unlockTime: number;

  const daoCount = 0;
  const voteId = 0;

  let snapshotId = "0x0";

  let proposalScript: string;

  before(async function() {
    this.timeout(0);

    unlockTime = getCurrentTimestamp() + 1000000;

    provider = ethers.provider;

    accounts = await ethers.getSigners();
    deployer = accounts[0];
    deployerAddress = await deployer.getAddress();
    team = [accounts[1], accounts[2], accounts[3]];

    minnow = accounts[4];
    minnowAddress = await minnow.getAddress();

    teamAddresses = [
      await team[0].getAddress(),
      await team[1].getAddress(),
      await team[2].getAddress(),
    ];

    daoParams = {
      tokenName: "Badger",
      tokenSymbol: "BADGER",
      id: `badger-finance${daoCount}`,
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

    daoParams = {
      tokenName: "Badger",
      tokenSymbol: "BADGER",
      id: `badger-finance${daoCount}`,
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

    console.log("Deploy DAO System...");
    daoSystem = await deployBadgerDAO(deployer, daoParams);

    console.log("Deploy Safe...");
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

    console.log("Deploy Smart Timelock...");
    smartTimelock = await deployContract(deployer, SmartTimelock, [
      daoSystem.token.address,
      teamAddresses[0],
      BigNumber.from(unlockTime),
    ]);

    console.log("Deploy Mocks...");
    tokenGifter = await deployContract(deployer, TokenGifter);
    ethGifter = await deployContract(deployer, EthGifter);

    await (
      await deployer.sendTransaction({
        to: ethGifter.address,
        value: utils.parseEther("100"),
      })
    ).wait();

    miscToken = await deployContract(deployer, MockToken, ["Misc", "MISC"]);

    await (await miscToken.mint(tokenGifter.address, tokenGifterAmount)).wait();

    console.log("Distributing mock token...");

    console.log(tokenGifter.address, smartTimelock.address);

    await (await miscToken.mint(tokenGifter.address, tokenGifterAmount)).wait();
    await (
      await miscToken.mint(smartTimelock.address, tokenGifterAmount)
    ).wait();

    console.log("Inital gToken distribution...");
    await (
      await daoSystem.token.transfer(tokenGifter.address, tokenGifterAmount)
    ).wait();

    await (
      await daoSystem.token.transfer(minnowAddress, tokenGifterAmount)
    ).wait();

    console.log("canForward", {
      deployerAddress: await daoSystem.tokenManager.canForward(
        deployerAddress,
        utils.hexlify("0x00")
      ),
      tokenGifter: await daoSystem.tokenManager.canForward(
        tokenGifter.address,
        utils.hexlify("0x00")
      ),
      user1: await daoSystem.tokenManager.canForward(
        teamAddresses[1],
        utils.hexlify("0x00")
      ),
      minnowAddress: await daoSystem.tokenManager.canForward(
        minnowAddress,
        utils.hexlify("0x00")
      ),
    });

    console.log("Create initial snapshot...");
    snapshotId = await setEvmSnapshot(provider);
    console.log("Initial Setup complete");
  });

  beforeEach(async function() {
    // Revert to post-setup state
    await revertEvmSnapshot(provider, snapshotId);
    snapshotId = await setEvmSnapshot(provider);
  });

  it("Should have correct parameters", async function() {
    const token = await smartTimelock.token();
    const beneficiary = await smartTimelock.beneficiary();
    const release = await smartTimelock.releaseTime();

    expect(token).to.be.equal(daoSystem.token.address);
    expect(beneficiary).to.be.equal(teamAddresses[0]);
    expect(release).to.be.equal(BigNumber.from(unlockTime));
  });

  it("Should not be able to release funds before release time", async function() {
    const releaseAmount = utils.parseEther("500000");

    await (
      await daoSystem.token
        .connect(deployer)
        .transfer(smartTimelock.address, releaseAmount)
    ).wait();

    await expect(smartTimelock.release()).to.be.reverted;
  });

  it("Should be able to release funds after timelock expires", async function() {
    const releaseAmount = utils.parseEther("500000");

    await (
      await daoSystem.token
        .connect(deployer)
        .transfer(smartTimelock.address, releaseAmount)
    ).wait();

    await increaseTime(provider, 1000000);
    await (await smartTimelock.release()).wait();

    const beneficiaryPostBalance = await daoSystem.token.balanceOf(
      teamAddresses[0]
    );
    const timelockPostBalance = await daoSystem.token.balanceOf(
      smartTimelock.address
    );

    expect(beneficiaryPostBalance, "Beneficiary Address").to.be.equal(
      releaseAmount
    );

    expect(timelockPostBalance, "Timelock Address").to.be.equal(
      BigNumber.from(0)
    );
  });

  describe("When SmartTimelock has minority voting share", async function() {
    beforeEach(async function() {
      await await daoSystem.token.transfer(
        smartTimelock.address,
        utils.parseEther("500000")
      );
    });

    xit("Should be able to create proposals", async function() {});

    xit("Should be able to vote", async function() {});

    it("EthGifter should be able to transfer eth", async function() {
      const preBalances = {
        ethGifter: await provider.getBalance(ethGifter.address),
        deployer: await provider.getBalance(deployerAddress),
      };

      await (await ethGifter.requestEth(ONE_ETHER)).wait();

      const postBalances = {
        ethGifter: await provider.getBalance(ethGifter.address),
        deployer: await provider.getBalance(deployerAddress),
      };

      expect(postBalances.ethGifter, "EthGifter loses one ETH").to.be.equal(
        preBalances.ethGifter.sub(ONE_ETHER)
      );
    });

    it("Should be able to claim ether using call function", async function() {
      const preBalances = {
        ethGifter: await provider.getBalance(ethGifter.address),
        timelock: await provider.getBalance(smartTimelock.address),
      };

      const tx = await smartTimelock
        .connect(team[0])
        .call(
          ethGifter.address,
          0,
          iEthGifter.encodeFunctionData("requestEth", [ONE_ETHER])
        );

      await tx.wait();

      const postBalances = {
        ethGifter: await provider.getBalance(ethGifter.address),
        timelock: await provider.getBalance(smartTimelock.address),
      };

      expect(postBalances.ethGifter, "EthGifter loses one ETH").to.be.equal(
        preBalances.ethGifter.sub(ONE_ETHER)
      );

      expect(postBalances.timelock, "Timelock gains one ETH").to.be.equal(
        preBalances.timelock.add(ONE_ETHER)
      );
    });

    it("Should be able to recieve native ether payments", async function() {
      const preBalances = {
        deployer: await provider.getBalance(deployerAddress),
        timelock: await provider.getBalance(smartTimelock.address),
      };

      await (
        await deployer.sendTransaction({
          to: smartTimelock.address,
          value: ONE_ETHER,
        })
      ).wait();

      const postBalances = {
        deployer: await provider.getBalance(deployerAddress),
        timelock: await provider.getBalance(smartTimelock.address),
      };

      expect(postBalances.deployer, "Deployer loses > one ETH").to.be.lt(
        preBalances.deployer.sub(ONE_ETHER) // Factoring in gas costs
      );

      expect(postBalances.timelock, "Timelock gains one ETH").to.be.equal(
        preBalances.timelock.add(ONE_ETHER)
      );
    });

    it("Should be able to send ether along with function call", async function() {
      const preBalances = {
        team0: await provider.getBalance(teamAddresses[0]),
        deployer: await provider.getBalance(deployerAddress),
      };
      await (
        await smartTimelock
          .connect(team[0])
          .call(deployerAddress, ONE_ETHER, "0x", {
            value: ONE_ETHER,
          })
      ).wait();

      const postBalances = {
        team0: await provider.getBalance(teamAddresses[0]),
        deployer: await provider.getBalance(deployerAddress),
      };

      expect(postBalances.deployer).to.be.equal(
        preBalances.deployer.add(ONE_ETHER)
      );

      expect(postBalances.team0).to.be.lt(preBalances.team0.sub(ONE_ETHER)); // Account for gas costs
    });

    it("Should be able to request tokens and increase balance of locked tokens using call function", async function() {
      const requestTransferAction = iTokenGifter.encodeFunctionData(
        "requestTransfer",
        [daoSystem.token.address, tokenRequestAmount]
      );

      const preBalance = await daoSystem.token.balanceOf(smartTimelock.address);

      await (
        await smartTimelock
          .connect(team[0])
          .call(tokenGifter.address, 0, requestTransferAction)
      ).wait();

      const postBalance = await daoSystem.token.balanceOf(
        smartTimelock.address
      );

      expect(preBalance.add(tokenRequestAmount)).to.be.equal(postBalance);
    });

    it("Should not be able to transfer locked tokens using call function", async function() {
      const transferAction = iERC20.encodeFunctionData("transfer", [
        teamAddresses[0],
        tokenGifterAmount,
      ]);

      await expect(
        smartTimelock
          .connect(team[0])
          .call(daoSystem.token.address, 0, transferAction)
      ).to.be.revertedWith("smart-timelock/locked-balance-check");
    });

    it("Should be able to transfer other tokens using call function", async function() {
      const transferAction = iERC20.encodeFunctionData("transfer", [
        teamAddresses[0],
        tokenGifterAmount,
      ]);

      const preBalance = await miscToken.balanceOf(smartTimelock.address);

      await (
        await smartTimelock
          .connect(team[0])
          .call(miscToken.address, 0, transferAction)
      ).wait();

      const postBalance = await miscToken.balanceOf(smartTimelock.address);

      expect(postBalance).to.be.equal(preBalance.sub(tokenGifterAmount));
    });

    it("Should not be able to claim locked tokens using claimToken()", async function() {
      await expect(
        smartTimelock.connect(team[0]).claimToken(daoSystem.token.address)
      ).to.be.revertedWith("smart-timelock/no-locked-token-claim");
    });

    it("Should be able to claim other tokens using claimToken()", async function() {
      await (
        await smartTimelock.connect(team[0]).claimToken(miscToken.address)
      ).wait();

      const postBalance = await miscToken.balanceOf(smartTimelock.address);
      expect(postBalance).to.be.equal(0);
    });
  });

  it("Non-beneficiary should not be able to call owner-gated functions", async function() {
    const requestTransferAction = iTokenGifter.encodeFunctionData(
      "requestTransfer",
      [daoSystem.token.address, tokenRequestAmount]
    );

    await expect(
      smartTimelock
        .connect(minnow)
        .call(tokenGifter.address, 0, requestTransferAction)
    ).to.be.reverted;

    await expect(
      smartTimelock.connect(minnow).claimToken(daoSystem.token.address)
    ).to.be.reverted;

    await expect(smartTimelock.connect(minnow).claimToken(miscToken.address)).to
      .be.reverted;

    await expect(smartTimelock.connect(minnow).claimEther()).to.be.reverted;
  });
});
