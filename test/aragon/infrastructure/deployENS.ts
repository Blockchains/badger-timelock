import { Contract, Signer } from 'ethers';
import { deployContract } from 'ethereum-waffle';

// ENS
import ENSFactory from '../../../dependency-artifacts/badger-dao/ENSFactory.json';
import ENS from '../../../dependency-artifacts/badger-dao/ENS.json';

export interface ENSSystem {
  ens: Contract
  ensFactory: Contract
}

export async function deployENS (deployer: Signer): Promise<ENSSystem> {
  const deployerAddress = await deployer.getAddress();
  const ensFactory = await deployContract(deployer, ENSFactory);
  await (await ensFactory.newENS(deployerAddress)).wait();
  console.log('Created ENSFactory');
  const events = await ensFactory.queryFilter(ensFactory.filters.DeployENS());
  const ensAddress = events[0]?.args?.ens;
  console.log(`Created ENS Instance ${ensAddress}`);
  const ens = new Contract(ensAddress, ENS.abi, deployer);
  return {
    ensFactory,
    ens
  };
}
