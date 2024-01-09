import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { exec } from 'child_process';
import path from 'path'
import { contracts } from '../typechain-types/factories';
import fs from 'fs'
import { JsonRpcProvider, ethers } from 'ethers';

interface ERC721MockArgs {
  name: string;
  symbol: string;
}

interface ERC721TimeLockArgs {
  'lock-period': number;
}

const ERC721MockIgnitionModule=path.join(__dirname,"../ignition/modules/erc721mockdeploy.ts");
const ERC721TimeLockIgnitionModule=path.join(__dirname,"../ignition/modules/erc721timelockdeploy.ts");

type NetworkDesc = {
  chainId: number,
  providerString: string
}
const networks:  Record<string, NetworkDesc> = {
  development: {
    chainId: 31337,
    providerString: "http://localhost:8545"
  },
  localhost: {
    chainId: 31337,
    providerString: "http://localhost:8545"
  },
  sepolia: {
    chainId: 11155111,
    providerString: "insert alchemy string"
  }
}

const ERC721Mock = {
  name: 'ERC721Mock',
  ignitionModule: path.join(__dirname, "../ignition/modules/erc721mockdeploy.ts"),
}

const ERC721TimeLock = {
  name: 'ERC721TimeLock',
  ignitionModule: path.join(__dirname, "../ignition/modules/erc721timelockdeploy.ts"),
}

function hexToUInt8Array(hexString: string): Uint8Array {
    // Validate the input
    if (!/^0x[a-fA-F0-9]+$/.test(hexString)) {
        throw new Error('Invalid hexadecimal string');
    }

    // Remove the '0x' prefix
    hexString = hexString.slice(2);

    // Calculate the number of bytes in the hex string
    const numBytes = hexString.length / 2;

    // Check if the hex string represents more than 32 bytes
    if (numBytes > 32) {
        throw new Error('Hexadecimal string represents more than 32 bytes');
    }

    // Create a buffer of 32 bytes, filled with zeros
    const bytes = new Uint8Array(32);

    // Convert hex string to bytes
    for (let i = 0; i < hexString.length; i += 2) {
        const byteIndex = 31 - Math.floor(i / 2); // Start filling from the end
        bytes[byteIndex] = parseInt(hexString.substr(i, 2), 16);
    }

    return bytes;
}

function readDeployedAddresses(chainNumber: number): { [key: string]: { address: string } } {
  // Construct the file path
  console.log(`Chain number: ${chainNumber}`);

  const filePath = path.join(__dirname, `../ignition/deployments/chain-${chainNumber}/deployed_addresses.json`);
  console.log(`Read deployed addresses from ${filePath}`);
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
    default: 'localhost',
    global: true
  })
  .command(
    'lock',
    'Lock an ERC721Mock token into an ERC721TimeLock contract',
    (yargs) => {
      return yargs.option('token-id', {
        alias: 't',
        describe: 'Token ID to lock',
        type: 'number',
        default: 1,
        demandOption: true,
      })
      .option('commitment', {
        alias: 'c',
        describe: 'Commitment to lock',
        type: 'string',
        default: '0x1234',
        demandOption: true,
      });
    },
    async (argv) => {
      // read the network id (based on the ignition deployments)
      const {chainId, providerString} = networks[argv.network];
      const tokenId = argv['token-id'];

      // ignition deployments save the deployed addresses in a json file
      const contractAddresses = readDeployedAddresses(chainId);

      // get the address of the ERC721 lock contract
      const ERC721TimeLockAddress = contractAddresses[ERC721TimeLock.name].address;

      // get the address of the ERC721Mock contract
      const ERC721MockAddress = contractAddresses[ERC721Mock.name].address;

      const abstract_provider = ethers.getDefaultProvider(providerString);

      if (!(abstract_provider instanceof JsonRpcProvider)) {
        console.log("Provider is not a JsonRpcProvider, exiting. (The websocket provider support should be easily added)");
      }
      const provider = abstract_provider as JsonRpcProvider;
      const signer = await provider.getSigner(); // assuming account 0
      const signerAddress = await signer.getAddress();

      const erc721TimeLockContract = contracts.ERC721TimeLock__factory.connect(ERC721TimeLockAddress, signer);
      const erc721MockContract = contracts.ERC721Mock__factory.connect(ERC721MockAddress, signer);

      const commitmentInBytes = hexToUInt8Array(argv.commitment);

      console.log(`Locking ERC721Mock token ${commitmentInBytes} into ${ERC721TimeLockAddress}`);

      await erc721MockContract.approve(ERC721TimeLockAddress, tokenId);
      await erc721TimeLockContract.lockToken(ERC721MockAddress, tokenId , commitmentInBytes);
  })
  .command(
    'mint',
    'Mint an ERC721Mock token into an account[0]',
    (yargs) => { return yargs },
    async (argv) => {
      // read the network id (based on the ignition deployments)
      const {chainId, providerString} = networks[argv.network];

      // ignition deployments save the deployed addresses in a json file
      const contractAddresses = readDeployedAddresses(chainId);

      // get the address of the ERC721Mock contract
      const ERC721MockAddress = contractAddresses[ERC721Mock.name].address;

      const abstract_provider = ethers.getDefaultProvider(providerString);

      if (!(abstract_provider instanceof JsonRpcProvider)) {
        console.log("Provider is not a JsonRpcProvider, exiting. (The websocket provider support should be easily added)");
      }
      const provider = abstract_provider as JsonRpcProvider;
      const signer = await provider.getSigner(); // assuming account 0
      const signerAddress = await signer.getAddress();
      const erc721MockContract = contracts.ERC721Mock__factory.connect(ERC721MockAddress, signer);

      console.log(`Minting ERC721Mock ${ERC721MockAddress} token into ${signerAddress}`);
      await erc721MockContract.mint(signerAddress);
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
      console.log(`Deploying ERC721Timelock with lock-period ${argv['lock-period']}`);
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
