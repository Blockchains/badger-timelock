export async function setEvmSnapshot (provider: any) {
  const id = await provider.send('evm_snapshot');
  return id;
}

export async function revertEvmSnapshot (provider: any, snapshot: string) {
  await provider.send('evm_revert', [snapshot]);
}
