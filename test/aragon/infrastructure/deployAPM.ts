import { Contract, Signer, utils, constants } from 'ethers';
import { deployContract } from 'ethereum-waffle';

import DAOFactory from '../../../dependency-artifacts/badger-dao/DAOFactory.json';
import ENS from '../../../dependency-artifacts/badger-dao/ENS.json';
import APMRegistry from '../../../dependency-artifacts/badger-dao/APMRegistry.json';
import Repo from '../../../dependency-artifacts/badger-dao/Repo.json';
import ENSSubdomainRegistrar from '../../../dependency-artifacts/badger-dao/ENSSubdomainRegistrar.json';
import APMRegistryFactory from '../../../dependency-artifacts/badger-dao/APMRegistryFactory.json';
import { ENSSystem } from './deployENS';

const { hash: namehash } = require('eth-ens-namehash');

export interface APMSystem {
  apmFactory: Contract
  apm: Contract
}

export async function deployAPM (deployer: Signer, ens: Contract, daoFactory: Contract): Promise<APMSystem> {
  const deployerAddress = await deployer.getAddress();

  const tldName = 'eth';
  const labelName = 'aragonpm';
  const tldHash = namehash(tldName);
  const labelHash = utils.keccak256(utils.toUtf8Bytes(labelName));
  const apmNode = namehash(`${labelName}.${tldName}`);

  console.log('ENS:', ens.address);
  console.log(`TLD: ${tldName} (${tldHash})`);
  console.log(`Label: ${labelName} (${labelHash})`);

  console.log('=========');
  console.log('Deploying APM bases...');

  const apmRegistryBase = await deployContract(deployer, APMRegistry);
  const apmRepoBase = await deployContract(deployer, Repo);
  const ensSubdomainRegistrarBase = await deployContract(deployer, ENSSubdomainRegistrar);

  console.log('Deploying APMRegistryFactory...');
  const apmFactory = await deployContract(deployer, APMRegistryFactory, [
    daoFactory.address,
    apmRegistryBase.address,
    apmRepoBase.address,
    ensSubdomainRegistrarBase.address,
    ens.address,
    constants.AddressZero
  ]);

  console.log(`Assigning ENS name (${labelName}.${tldName}) to factory...`);

  console.log('Deployer', deployerAddress);
  console.log('Node Owner', await ens.owner(tldHash));
  await (await ens.setSubnodeOwner(tldHash, labelHash, deployerAddress)).wait();
  await (await ens.setOwner(apmNode, deployerAddress)).wait();

  if ((await ens.owner(apmNode)) === deployerAddress) {
    console.log('Transferring name ownership from deployer to APMRegistryFactory');
    await (await ens.setOwner(apmNode, apmFactory.address)).wait();
  } else {
    console.log('Creating subdomain and assigning it to APMRegistryFactory');
    try {
      await (await ens.setSubnodeOwner(tldHash, labelHash, apmFactory.address)).wait();
    } catch (err) {
      console.error(
        `Error: could not set the owner of '${labelName}.${tldName}' on the given ENS instance`,
        `(${ens.address}). Make sure you have ownership rights over the subdomain.`
      );
      throw err;
    }
  }

  console.log('Deploying APM...');
  const receipt = await (await apmFactory.newAPM(tldHash, labelHash, deployerAddress)).wait();

  const apmDeployEvents = await apmFactory.queryFilter(apmFactory.filters.DeployAPM());
  const apmRegistryAddress = apmDeployEvents[0]?.args?.apm;

  console.log('# APM:');
  console.log('Address:', apmRegistryAddress);
  console.log('Transaction hash:', receipt.tx);
  console.log('=========');

  const apm = new Contract(apmRegistryAddress, APMRegistry.abi, deployer);

  return {
    apmFactory,
    apm
  };
}
