import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { exec } from 'child_process';
import path from 'path'


interface ERC721MockArgs {
  name: string;
  symbol: string;
}

interface ERC721TimeLockArgs {
  'lock-period': number;
}

const ERC721MockIgnitionModule=path.join(__dirname,"../ignition/modules/erc721mockdeploy.ts");
const ERC721TimeLockIgnitionModule=path.join(__dirname,"../ignition/modules/erc721timelockdeploy.ts");


yargs(hideBin(process.argv))
  .option('network', {
    alias: 'net',
    describe: 'The network to deploy to',
    type: 'string',
    default: 'localhost', // Default network, change as needed
    global: true
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
