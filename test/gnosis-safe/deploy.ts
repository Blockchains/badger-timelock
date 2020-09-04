import { ethers } from 'ethers'
import { deployContract } from 'ethereum-waffle'
import { Contract, Signer, BigNumber, utils } from 'ethers'

import GnosisSafe from '../../dependency-artifacts/gnosis-safe/GnosisSafe.json'
import GnosisSafeProxyFactory from '../../dependency-artifacts/gnosis-safe/GnosisSafeProxyFactory.json'
import GnosisSafeProxy from '../../dependency-artifacts/gnosis-safe/GnosisSafeProxy.json'

let proxyFactory: Contract
let gnosisSafeMasterCopy: Contract

export const deployGnosisSafeInfrastructure = async (deployer: Signer) => {
  proxyFactory = await deployContract(deployer, GnosisSafeProxyFactory)
  console.log('Deployed Gnosis Safe ProxyFactory')

  gnosisSafeMasterCopy = await deployContract(deployer, GnosisSafe, undefined, { gasLimit: 9999999 })
  console.log('Deployed Gnosis Safe Master Copy')
}

export const deployGnosisSafe = async (deployer: Signer, params: any[]) => {
  const iface = new ethers.utils.Interface(GnosisSafe.abi)
  const encoded = iface.encodeFunctionData('setup', params)

  const deployerAddress = await deployer.getAddress()
  const tx = await proxyFactory.createProxy(gnosisSafeMasterCopy.address, encoded)
  await tx.wait()

  const events = await proxyFactory.queryFilter(proxyFactory.filters.ProxyCreation())
  console.log(`Created Gnosis Safe Instance ${events[0]?.args?.proxy}`)

  return new Contract(events[0]?.args?.proxy, GnosisSafe.abi, deployer)
}