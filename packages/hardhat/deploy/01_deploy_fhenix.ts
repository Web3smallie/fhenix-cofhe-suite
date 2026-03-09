import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployFhenix: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("FHEVault", { from: deployer, log: true });
  await deploy("PrivatePredictionMarket", { from: deployer, log: true });
  await deploy("PrivateVoting", { from: deployer, log: true });
  await deploy("PrivatePerpDEX", { from: deployer, log: true });
};

export default deployFhenix;
deployFhenix.tags = ["FhenixPrivacySuite"];