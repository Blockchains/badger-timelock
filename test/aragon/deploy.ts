import { run, ethers } from '@nomiclabs/buidler'
import { deployContract, MockProvider, solidity } from 'ethereum-waffle'
import { Contract, Signer, providers, BigNumber, utils, EventFilter } from 'ethers'
import fs from 'fs'
const { hash: namehash } = require('eth-ens-namehash')
import { TemplateDeployer } from './TemplateDeployer'
import { APP_IDS_TO_NAME, APP_IDS, APPS } from './infrastructure/apps'

// Badger DAO

export interface DAOParams {
  tokenName: string
  tokenSymbol: string
  id: string
  holders: string[]
  stakes: BigNumber[]
  votingSettings: BigNumber[]
  financePeriod: BigNumber
  useAgentAsVault: boolean
}

export interface BadgerDAO {
  dao: Contract
  token: Contract
  agent: Contract
  finance: Contract
  voting: Contract
  tokenManager: Contract
}

let template: Contract

import Agent from '../../dependency-artifacts/badger-dao/Agent.json'
import Finance from '../../dependency-artifacts/badger-dao/Finance.json'
import Vault from '../../dependency-artifacts/badger-dao/Vault.json'
import Voting from '../../dependency-artifacts/badger-dao/Voting.json'
import Survey from '../../dependency-artifacts/badger-dao/Survey.json'
import Payroll from '../../dependency-artifacts/badger-dao/Payroll.json'
import Kernel from '../../dependency-artifacts/badger-dao/Kernel.json'
import TokenManager from '../../dependency-artifacts/badger-dao/TokenManager.json'
import ERC20 from '../../dependency-artifacts/badger-dao/ERC20.json'

export const deployAragonInfrastructure = async (deployer: Signer) => {
  const templateDeployer = new TemplateDeployer(deployer)
  template = await templateDeployer.deploy()
}

const createAppInstance = (appId: string, appProxy: string, deployer: Signer): Contract => {
  // @ts-ignore
  const appName = APP_IDS_TO_NAME[appId]
  const appInfo = APPS.find(app => app.name === appName)
  if (!appInfo) {
    throw new Error(`No artifact found for app ${appName}`)
  }

  console.log(appInfo.name, appInfo.contractName)

  // @ts-ignore
  return new Contract(appProxy, appInfo.artifact.abi, deployer)
}

export const deployBadgerDAO = async (deployer: Signer, params: DAOParams): Promise<BadgerDAO> => {
  console.log(template.functions)
  await (
    await template.newTokenAndInstance(
      params.tokenName,
      params.tokenSymbol,
      params.id,
      params.holders,
      params.stakes,
      params.votingSettings,
      params.financePeriod,
      params.useAgentAsVault
    )
  ).wait()

  const daoEvents = await template.queryFilter(template.filters.DeployDao())
  const tokenEvents = await template.queryFilter(template.filters.DeployToken())
  const appEvents = await template.queryFilter(template.filters.InstalledApp())

  const daoAddress = daoEvents[0].args?.dao
  const tokenAddress = tokenEvents[0].args?.token

  const dao = new Contract(daoAddress, Kernel.abi, deployer)
  const token = new Contract(tokenAddress, ERC20.abi, deployer)

  const EMPTY_CONTRACT = new Contract(ethers.constants.AddressZero, Agent.abi, deployer)

  const badgerDAO: BadgerDAO = {
    dao,
    token,
    agent: EMPTY_CONTRACT,
    finance: EMPTY_CONTRACT,
    voting: EMPTY_CONTRACT,
    tokenManager: EMPTY_CONTRACT
  }

  for (const event of appEvents) {
    const appContract = createAppInstance(event.args?.appId, event.args?.appProxy, deployer)
    // @ts-ignore
    const appName = APP_IDS_TO_NAME[event.args?.appId]
    console.log(appName, appContract.address, event.args?.appProxy)

    if (appName === 'token-manager') {
      badgerDAO.tokenManager = appContract
    } else {
    // @ts-ignore
    badgerDAO[appName] = appContract
    }
  }

  console.log({
    dao: badgerDAO.dao.address,
    token: badgerDAO.token.address,
    agent: badgerDAO.agent.address,
    finance: badgerDAO.finance.address,
    voting: badgerDAO.voting.address,
    tokenManager: badgerDAO.tokenManager.address
  })

  return badgerDAO
}
