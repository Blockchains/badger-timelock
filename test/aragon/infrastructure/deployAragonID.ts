import { Contract, Signer, utils } from 'ethers'
import { deployContract } from 'ethereum-waffle'

import FIFSResolvingRegistrar from '../../../dependency-artifacts/badger-dao/FIFSResolvingRegistrar.json'
import ENS from '../../../dependency-artifacts/badger-dao/ENS.json'
const { hash: namehash } = require('eth-ens-namehash')

const tld = namehash('eth')
const label = utils.keccak256(utils.toUtf8Bytes('aragonid'))
const node = namehash('aragonid.eth')

export interface AragonIDSystem {
  publicResolver: Contract
  aragonID: Contract
}

export async function deployAragonID(deployer: Signer, ens: Contract): Promise<AragonIDSystem> {
  const deployerAddress = await deployer.getAddress()

  console.log(`Deploying AragonID with ENS: ${ens.address} and owner: ${deployerAddress}`)

  const publicResolver = await ens.resolver(namehash('resolver.eth'))

  const aragonID = await deployContract(deployer, FIFSResolvingRegistrar, [ens.address, publicResolver, node])

  await (await ens.setSubnodeOwner(tld, label, deployerAddress)).wait()
  await (await ens.setOwner(node, deployerAddress)).wait()

  console.log('assigning ENS name to AragonID')

  if ((await ens.owner(node)) === deployerAddress) {
    console.log('Transferring name ownership from deployer to AragonID')
    await (await ens.setOwner(node, aragonID.address)).wait()
  } else {
    console.log('Creating subdomain and assigning it to AragonID')
    try {
      await (await ens.setSubnodeOwner(tld, label, aragonID.address)).wait()
    } catch (err) {
      console.error(
        `Error: could not set the owner of 'aragonid.eth' on the given ENS instance`,
        `(${ens.address}). Make sure you have ownership rights over the subdomain.`
      )
      throw err
    }
  }

  if (deployerAddress) {
    console.log('assigning owner name')
    await (await aragonID.register(utils.keccak256(utils.toUtf8Bytes('owner')), deployerAddress)).wait()
  }

  console.log('===========')
  console.log('Deployed AragonID:', aragonID.address)

  return {
    publicResolver,
    aragonID
  }
}