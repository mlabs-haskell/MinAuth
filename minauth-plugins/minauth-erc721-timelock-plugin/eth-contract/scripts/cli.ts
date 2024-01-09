import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { exec } from 'child_process';
import path from 'path'
import { contracts } from '../typechain-types/factories';
import { ethers } from 'hardhat';
import fs from 'fs'

interface ERC721MockArgs {
  name: string;
  symbol: string;
}

interface ERC721TimeLockArgs {
  'lock-period': number;
}

const ERC721MockIgnitionModule=path.join(__dirname,"../ignition/modules/erc721mockdeploy.ts");
const ERC721TimeLockIgnitionModule=path.join(__dirname,"../ignition/modules/erc721timelockdeploy.ts");

const networks:  Record<string, number> = {
  development: 31337,
  sepolia: 11155111
}

const address0 =  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

const ERC721Mock = {
  name: 'ERC721Mock',
  ignitionModule: path.join(__dirname, "../ignition/modules/erc721mockdeploy.ts"),
}
const ERC721MockContractName = 'ERC721Mock';

function readDeployedAddresses(chainNumber: number): { [key: string]: { address: string } } {
  // Construct the file path
  const filePath = path.join(__dirname, `../ignition/deployments/chain-${chainNumber}/deployed-addresses.json`);

  // Read the file
  const fileContents = fs.readFileSync(filePath, 'utf8');

  // Parse the JSON
  const deployedAddresses = JSON.parse(fileContents);

  // Transform the data into the desired format
  const transformedData: { [key: string]: { address: string } } = {};

  Object.keys(deployedAddresses).forEach(key => {
    // Extract the contract name
    const contractName = key.split('#')[1];
    if (contractName) {
      transformedData[contractName] = { address: deployedAddresses[key] };
    }
  });

  return transformedData;
}



yargs(hideBin(process.argv))
  .option('network', {
    alias: 'net',
    describe: 'The network to deploy to',
    type: 'string',
    default: 'localhost', // Default network, change as needed
    global: true
  })
  .command(
    'mint',
    'Mint an ERC721Mock token into an account[0]',
    (yargs) => { return yargs },
    async (argv) => {
      const contractAddresses = readDeployedAddresses(networks[argv.network]);
      const ERC721MockAddress = contractAddresses[ERC721Mock.name].address;


        const [owner, otherAccount] = await ethers.getSigners();
        const erc721Mock = new contracts.ERC721Mock__factory(owner).connect(owner);
        await erc721Mock.mint(owner.address);
    const deployCommand = `npx hardhat ignition call --network ${argv.network} --contract ${ERC721MockContractName} --method mint --parameters '["${address0}"]'`;

    exec(deployCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return;
      }
      if (stderr) {
        console.error(`Stderr: ${stderr}`);
        return;
      }
      console.log(stdout);
    });
  })
  .command<ERC721MockArgs>(
    'deploy-erc721mock',
    'Deploy the ERC721Mock contract',
    (yargs) => {
      return yargs
        .option('name', {
          alias: 'n',
          describe: 'Name for the ERC721Mock token',
          type: 'string',
          demandOption: true,
        })
        .option('symbol', {
          alias: 's',
          describe: 'Symbol for the ERC721Mock token',
          type: 'string',
          demandOption: true,
        });
    },
    async (argv) => {
      console.log(`Deploying ERC721Mock with name: ${argv.name}, symbol: ${argv.symbol}`);
      const deployCommand = `npx hardhat ignition deploy ${ERC721MockIgnitionModule} --network ${argv.network} --parameters '{"ERC721MockDeployment": {"name": "${argv.name}", "symbol": "${argv.symbol}"}}'`;

      exec(deployCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`Stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    }
  )
  .command<ERC721TimeLockArgs>(
    'deploy-erc721timelock',
    'Deploy the ERC721TimeLock contract',
    (yargs) => {
      return yargs
        .option('lock-period', {
          alias: 'l',
          describe: 'Lock period for the ERC721TimeLock',
          type: 'number',
          demandOption: true,
        });
    },
    async (argv) => {
      console.log(`Deploying ERC721Mock with name: ${argv.name}, symbol: ${argv.symbol}`);
      const deployCommand = `npx hardhat ignition deploy ${ERC721TimeLockIgnitionModule} --network ${argv.network} --parameters '{"ERC721TimeLockDeployment": {"lock-period": "${argv['lock-period']}"}}'`;

      exec(deployCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error: ${error.message}`);
          return;
        }
        if (stderr) {
          console.error(`Stderr: ${stderr}`);
          return;
        }
        console.log(stdout);
      });
    }
  )
  .help()
  .demandCommand(1, 'You need at least one command before moving on')
  .argv;
