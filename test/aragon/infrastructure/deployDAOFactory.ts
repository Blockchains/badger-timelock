import { Contract, Signer, utils } from 'ethers';
import { deployContract } from 'ethereum-waffle';

import Kernel from '../../../dependency-artifacts/badger-dao/Kernel.json';
import ACL from '../../../dependency-artifacts/badger-dao/ACL.json';
import EVMScriptRegistryFactory from '../../../dependency-artifacts/badger-dao/EVMScriptRegistryFactory.json';
import DAOFactory from '../../../dependency-artifacts/badger-dao/DAOFactory.json';

const { hash: namehash } = require('eth-ens-namehash');

export interface DAOFactoySystem {
  aclBase: Contract
  daoFactory: Contract
  evmScriptRegistryFactory: Contract
  kernelBase: Contract
}

export async function deployDAOFactory (deployer: Signer): Promise<DAOFactoySystem> {
  const deployerAddress = await deployer.getAddress();

  const kernelBase = await deployContract(deployer, Kernel);
  const aclBase = await deployContract(deployer, ACL);
  const evmScriptRegistryFactory = await deployContract(deployer, EVMScriptRegistryFactory);

  const daoFactory = await deployContract(deployer, DAOFactory, [
    kernelBase.address,
    aclBase.address,
    evmScriptRegistryFactory.address
  ]);

  return {
    aclBase,
    daoFactory,
    evmScriptRegistryFactory,
    kernelBase
  };
}
