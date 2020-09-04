import { Contract, Signer } from 'ethers'
const { hash: namehash } = require('eth-ens-namehash')

import BadgerDAOTemplate from '../../dependency-artifacts/badger-dao/BadgerDAOTemplate.json'

import MiniMeTokenFactory from '../../dependency-artifacts/badger-dao/MiniMeTokenFactory.json'
import Agent from '../../dependency-artifacts/badger-dao/Agent.json'
import Vault from '../../dependency-artifacts/badger-dao/Vault.json'
import Voting from '../../dependency-artifacts/badger-dao/Voting.json'
import Survey from '../../dependency-artifacts/badger-dao/Survey.json'
import Payroll from '../../dependency-artifacts/badger-dao/Payroll.json'
import Finance from '../../dependency-artifacts/badger-dao/Finance.json'
import TokenManager from '../../dependency-artifacts/badger-dao/TokenManager.json'
import PublicResolver from '../../dependency-artifacts/badger-dao/PublicResolver.json'

import { deployDAOFactory, DAOFactoySystem } from './infrastructure/deployDAOFactory'
import { deployENS, ENSSystem } from './infrastructure/deployENS'
import { deployAPM, APMSystem } from './infrastructure/deployAPM'
import { deployAragonID, AragonIDSystem } from './infrastructure/deployAragonID'
import { deployContract } from 'ethereum-waffle'

import { APPS } from './infrastructure/apps'

const appArtifacts = {
  agent: Agent,
  vault: Vault,
  voting: Voting,
  survey: Survey,
  payroll: Payroll,
  finance: Finance,
  'token-manager': TokenManager
}

const TEMPLATE_NAME = 'company-template'
const CONTRACT_NAME = 'CompanyTemplate'

export class TemplateDeployer {
  ensSystem!: ENSSystem
  daoFactorySystem!: DAOFactoySystem
  apmSystem!: APMSystem
  aragonIDSystem!: AragonIDSystem
  miniMeFactory!: Contract

  deployer: Signer

  constructor(deployer: Signer) {
    this.deployer = deployer
  }

  async deploy() {
    await this.fetchOrDeployDependencies()
    const template = await this.deployTemplate()
    await this.registerDeploy(TEMPLATE_NAME, template)
    return template
  }

  async deployTemplate() {
    const {
      deployer,
      daoFactorySystem: { daoFactory },
      miniMeFactory,
      ensSystem: { ens },
      aragonIDSystem: { aragonID }
    } = this
    const template = await deployContract(deployer, BadgerDAOTemplate, [
      daoFactory.address,
      ens.address,
      miniMeFactory.address,
      aragonID.address
    ])
    return template
  }

  async fetchOrDeployDependencies() {
    await this._fetchOrDeployENS()
    await this._fetchOrDeployDAOFactory()
    await this._fetchOrDeployAPM()
    await this._fetchOrDeployAragonID()
    await this._fetchOrDeployMiniMeFactory()
    await this._checkAppsDeployment()
  }

  async registerDeploy(templateName: string, template: Contract) {
    if ((await this.isLocal()) && !(await this._isPackageRegistered(templateName))) {
      await this._registerPackage(templateName, template)
    }
  }

  async _checkAppsDeployment() {
    for (const { name, contractName, artifact } of APPS) {
      console.log('Registering App...', name, contractName )
      await this._registerApp(name, artifact)
    }
  }

  async _fetchOrDeployENS() {
    this.ensSystem = await deployENS(this.deployer)
  }

  async _fetchOrDeployAPM() {
    const {
      deployer,
      ensSystem: { ens },
      daoFactorySystem: { daoFactory }
    } = this
    this.apmSystem = await deployAPM(deployer, ens, daoFactory)
  }

  async _fetchOrDeployAragonID() {
    const {
      deployer,
      ensSystem: { ens }
    } = this
    this.aragonIDSystem = await deployAragonID(deployer, ens)
  }

  async _fetchOrDeployDAOFactory() {
    this.daoFactorySystem = await deployDAOFactory(this.deployer)
  }

  async _fetchOrDeployMiniMeFactory() {
    this.miniMeFactory = await deployContract(this.deployer, MiniMeTokenFactory)
  }

  async _fetchRegisteredAPM() {
    const {
      deployer,
      ensSystem: { ens }
    } = this
    const aragonPMHash = namehash('aragonpm.eth')
    const publicResolverAddress = await ens.resolver(aragonPMHash)
    const resolver = new Contract(publicResolverAddress, PublicResolver.abi, deployer)
    const address = await resolver.addr(aragonPMHash)
    return address
  }

  async _fetchRegisteredAragonID() {
    const {
      ensSystem: { ens }
    } = this
    const aragonIDHash = namehash('aragonid.eth')
    return await ens.owner(aragonIDHash)
  }

  async _registerApp(name: string, artifact: any) {
    // @ts-ignore
    const app = await deployContract(this.deployer, artifact, undefined, {gasLimit: 12500000 })
    console.log(`App ${name} deployed at ${app.address}`)
    return this._registerPackage(name, app)
  }

  async _registerPackage(name: string, contract: Contract) {
    const {
      deployer,
      apmSystem: { apm }
    } = this

    const deployerAddress = await deployer.getAddress()

    console.log(`Registering package for ${contract.address} as "${name}.aragonpm.eth"`)

    await (await apm.newRepoWithVersion(name, deployerAddress, [1, 0, 0], contract.address, '0x')).wait()
  }
  async _isAPMRegistered() {
    return this._isRepoRegistered(namehash('aragonpm.eth'))
  }

  async _isAragonIdRegistered() {
    return this._isRepoRegistered(namehash('aragonid.eth'))
  }

  async _isPackageRegistered(name: string) {
    return this._isRepoRegistered(namehash(`${name}.aragonpm.eth`))
  }

  async _isRepoRegistered(hash: string) {
    const {
      ensSystem: { ens }
    } = this
    const owner = await ens.owner(hash)
    return owner !== '0x0000000000000000000000000000000000000000' && owner !== '0x'
  }

  async isLocal() {
    return true
  }
}
