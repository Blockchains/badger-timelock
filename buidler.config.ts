import { task, usePlugin } from "@nomiclabs/buidler/config";

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("solidity-coverage");

// This is a sample Buidler task. To learn how to create your own go to
// https://buidler.dev/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, bre) => {
  const accounts = await bre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

export default {
  defaultNetwork: "buidlerevm",
  networks: {
    buidlerevm: {
      chaindId: 31337,
      blockGasLimit: 12500000
    },
    coverage2: {
      url: 'http://localhost:8555'
    },
    coverage: {
      url: 'http://localhost:8555'
    }
  },
  solc: {
    version: "0.6.8",
  },
};